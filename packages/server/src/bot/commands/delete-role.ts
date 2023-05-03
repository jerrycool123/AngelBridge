import { SlashCommandBuilder, User } from 'discord.js';

import DiscordUtility from '../../libs/discord.js';
import MembershipRoleCollection from '../../models/membership-role.js';
import MembershipCollection from '../../models/membership.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import DiscordBotConfig from '../config.js';
import { CustomBotError } from '../utils/bot-error.js';
import { genericOption } from '../utils/common.js';
import awaitConfirm from '../utils/confirm.js';
import { useBotWithManageRolePermission, useGuildOnly } from '../utils/middleware.js';
import { requireManageableRole } from '../utils/validator.js';
import CustomBotCommand from './index.js';

const delete_role = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('delete-role')
    .setDescription('Delete a YouTube membership role in this server')
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions)
    .addRoleOption(genericOption('role', 'The YouTube Membership role in this server', true)),
  execute: useGuildOnly(
    useBotWithManageRolePermission(async (interaction) => {
      const { guild, options, client } = interaction;

      await interaction.deferReply({ ephemeral: true });

      // Check if the role is manageable
      const role = options.getRole('role', true);
      await requireManageableRole(interaction, guild, role.id);

      // Find membership role and members with the role in DB
      const [membershipRoleDoc, membershipDocs] = await Promise.all([
        MembershipRoleCollection.findById(role.id)
          .populate<{
            youTubeChannel: YouTubeChannelDoc | null;
          }>('youTubeChannel')
          .orFail(
            new CustomBotError(
              `The role <@&${role.id}> is not a membership role in this server.\n` +
                'You can use `/settings` to see the list of membership roles in this server.',
              interaction,
            ),
          ),
        MembershipCollection.find({
          membershipRole: role.id,
        }),
      ]);

      // Ask for confirmation
      const confirmButtonInteraction = await awaitConfirm(interaction, 'delete-role', {
        content:
          `Are you sure you want to delete the membership role <@&${
            role.id
          }> for the YouTube channel \`${
            membershipRoleDoc.youTubeChannel?.title ?? '[Unknown Channel]'
          }\`?\n` +
          `This action will remove the membership role from ${membershipDocs.length} members.\n\n` +
          `Note that we won't delete the role in Discord. Instead, we just delete the membership role in the database, and remove the role from registered members.`,
      });
      await confirmButtonInteraction.deferReply({ ephemeral: true });

      // Remove user membership record in DB
      await MembershipCollection.deleteMany({
        membershipRole: membershipRoleDoc._id,
      });

      // Remove membership role in DB
      await MembershipRoleCollection.findByIdAndDelete(membershipRoleDoc._id);
      await confirmButtonInteraction.editReply({
        content: `Successfully deleted the membership role <@&${
          role.id
        }> for the YouTube channel \`${
          membershipRoleDoc.youTubeChannel?.title ?? '[Unknown Channel]'
        }\`.`,
      });

      // DM user about the removal
      membershipDocs.forEach((membershipDoc) =>
        DiscordUtility.addJobToQueue(async () => {
          let user: User | null = null;
          try {
            const member = await guild.members.fetch(membershipDoc.user);
            user = member.user;
            await member.roles.remove(membershipRoleDoc._id);
          } catch (error) {
            console.error(error);
            console.error(
              `Failed to remove role ${membershipRoleDoc.name}(ID: ${membershipRoleDoc._id}) from user with ID ${membershipDoc.user} in guild ${guild.name}(ID: ${guild.id}).`,
            );
          }

          try {
            if (user === null) user = await client.users.fetch(membershipDoc.user);
            await user.send(
              `Your membership role **@${membershipRoleDoc.name}** has been removed, since it has been deleted by a moderator in the server \`${guild.name}\`.`,
            );
          } catch (error) {
            // We cannot DM the user, so we just ignore it
            console.error(error);
          }
        }),
      );
    }),
  ),
});

export default delete_role;
