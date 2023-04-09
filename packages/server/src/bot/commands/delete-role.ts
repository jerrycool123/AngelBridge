import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ComponentType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  User,
} from 'discord.js';

import { genericOption, replyGuildOnly } from '../../libs/discord-util.js';
import sleep from '../../libs/sleep.js';
import MembershipRoleCollection from '../../models/membership-role.js';
import MembershipCollection from '../../models/membership.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import DiscordBotConfig from '../config.js';
import CustomBotCommand from './index.js';

const delete_role = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('delete-role')
    .setDescription('Delete a YouTube membership role in this guild')
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions)
    .addRoleOption(genericOption('role', 'The YouTube Membership role in this guild', true)),
  async execute(interaction) {
    const { guild, user, options, client } = interaction;
    if (!guild) {
      await replyGuildOnly(interaction);
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    // Handle role checks
    const botMember = await guild.members.fetchMe({ force: true });
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.editReply({
        content: `The bot does not have the \`Manage Roles\` permission.\nPlease try again after giving the bot the permission.`,
      });
      return;
    }

    const role = options.getRole('role', true);
    if (botMember.roles.highest.comparePositionTo(role.id) <= 0) {
      await interaction.editReply({
        content: `Due to the role hierarchy, the bot cannot remove the role <@&${role.id}> to users.\nI can only remove a role whose order is lower than that of my highest role highest role <@&${botMember.roles.highest.id}>.`,
      });
      return;
    }

    const membershipRoleDoc = await MembershipRoleCollection.findById(role.id).populate<{
      youTubeChannel: YouTubeChannelDoc;
    }>('youTubeChannel');
    if (!membershipRoleDoc) {
      await interaction.editReply({
        content: `The role <@&${role.id}> is not a membership role in this server.`,
      });
      return;
    }

    const membershipDocs = await MembershipCollection.find({
      membershipRole: membershipRoleDoc._id,
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('delete-role-confirm-button')
        .setLabel('Yes, I confirm')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('delete-role-cancel-button')
        .setLabel('No, cancel')
        .setStyle(ButtonStyle.Danger),
    );

    const response = await interaction.editReply({
      content:
        `Are you sure you want to delete the membership role <@&${role.id}> for the YouTube channel \`${membershipRoleDoc.youTubeChannel.title}\`?\n` +
        `This action will remove the membership role from ${membershipDocs.length} members.\n\n` +
        `Note that we won't delete the role in Discord. Instead, we just delete the membership role in the database, and remove the role from registered members.`,
      components: [actionRow],
    });

    let buttonInteraction: ButtonInteraction<CacheType> | undefined = undefined;
    try {
      buttonInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (buttonInteraction) =>
          user.id === buttonInteraction.user.id &&
          ['delete-role-confirm-button', 'delete-role-cancel-button'].includes(
            buttonInteraction.customId,
          ),
        time: 60 * 1000,
      });
    } catch (error) {
      // Timeout
    }
    if (!buttonInteraction) {
      await interaction.editReply({
        content: 'Timed out. Please try again.',
        components: [],
      });
    } else if (buttonInteraction.customId === 'delete-role-cancel-button') {
      actionRow.components.forEach((component) => component.setDisabled(true));
      await interaction.editReply({
        components: [actionRow],
      });
      await buttonInteraction.reply({
        content: 'Cancelled.',
        ephemeral: true,
      });
    } else if (buttonInteraction.customId === 'delete-role-confirm-button') {
      await buttonInteraction.deferReply({ ephemeral: true });

      // Remove user membership record in DB
      await MembershipCollection.deleteMany({
        membershipRole: membershipRoleDoc._id,
      });

      // Remove membership role in DB
      await MembershipRoleCollection.findByIdAndDelete(membershipRoleDoc._id);

      await buttonInteraction.editReply({
        content: `Successfully deleted the membership role <@&${role.id}> for the YouTube channel \`${membershipRoleDoc.youTubeChannel.title}\`.`,
      });

      // DM user about the removal
      for (const membershipDoc of membershipDocs) {
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
          if (!user) user = await client.users.fetch(membershipDoc.user);
          await user.send(
            `Your membership role **@${membershipRoleDoc.name}** has been removed, since it has been deleted by a moderator in the server \`${guild.name}\`.`,
          );
        } catch (error) {
          // We cannot DM the user, so we just ignore it
          console.error(error);
        }
        await sleep(100);
      }
    }
  },
});

export default delete_role;
