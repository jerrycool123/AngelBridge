import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildChannel,
  GuildMember,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ModalSubmitInteraction } from 'discord.js';
import { CacheType } from 'discord.js';

import { createRejectedActionRow } from '../../libs/discord-util.js';
import {
  parseMembershipVerificationRequestEmbed,
  replyInvalidRequest,
} from '../../libs/membership.js';
import DiscordBotConfig from '../config.js';
import CustomButton from './index.js';

const membershipRejectButton = new CustomButton({
  customId: 'membership-reject',
  data: new ButtonBuilder().setStyle(ButtonStyle.Danger).setLabel('Reject'),
  execute: async (interaction) => {
    const { guild, channel, user: moderator } = interaction;
    if (!guild || !channel || !(channel instanceof GuildChannel)) return;

    // Fetch moderator
    const moderatorMember = await guild.members.fetch({ user: moderator, force: true });
    if (!moderatorMember.permissionsIn(channel).has(DiscordBotConfig.adminPermissions)) {
      await interaction.reply({
        content: 'You do not have `Manage Roles` permission to accept membership requests.',
      });
      return;
    }

    // Parse embed
    const parsedResult = parseMembershipVerificationRequestEmbed(
      interaction.message.embeds[0] ?? null,
    );
    if (!parsedResult) {
      return await replyInvalidRequest(interaction);
    }
    const { userId, roleId } = parsedResult;

    const role = await guild.roles.fetch(roleId, { force: true });

    // Fetch guild member
    let member: GuildMember | null = null;
    try {
      member = await guild.members.fetch(userId);
    } catch (error) {
      console.error(error);
    }
    if (!member) {
      await interaction.editReply({
        content: `Failed to retrieve the member <@${userId}> from the guild.`,
      });
      return;
    }

    // Create reject modal
    const rejectModal = new ModalBuilder()
      .setCustomId('membership-reject-modal')
      .setTitle('Reject Membership Request')
      .addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('membership-reject-reason')
            .setLabel('Reason (this will be sent to the user)')
            .setPlaceholder('We cannot recognize your picture...')
            .setStyle(TextInputStyle.Short)
            .setRequired(false),
        ),
      );

    await interaction.showModal(rejectModal);

    // Receive rejection reason from the modal
    let modalSubmitInteraction: ModalSubmitInteraction<CacheType> | null = null;
    try {
      modalSubmitInteraction = await interaction.awaitModalSubmit({
        filter: (modalSubmitInteraction) =>
          moderator.id === modalSubmitInteraction.user.id &&
          modalSubmitInteraction.customId === 'membership-reject-modal',
        time: 60 * 1000,
      });
    } catch (error) {
      // Timeout
    }
    if (!modalSubmitInteraction) {
      await interaction.followUp({ content: 'Timed out. Please try again.', ephemeral: true });
      return;
    }

    await modalSubmitInteraction.deferReply();

    const reason = modalSubmitInteraction.fields.getTextInputValue('membership-reject-reason');

    // DM the user
    const dmChannel = await member.createDM();
    let notified = false;
    try {
      await dmChannel.send({
        content:
          `You have been rejected to be granted the membership role **${
            role ? `@${role.name}` : `<@&${roleId}>`
          }** in the server \`${guild.name}\`.` +
          (reason.length > 0 ? `\nReason: \`\`\`\n${reason}\n\`\`\`` : ''),
      });
      notified = true;
    } catch (error) {
      // User does not allow DMs
    }

    // Mark the request as rejected
    const rejectedActionRow = createRejectedActionRow();
    await interaction.message.edit({
      components: [rejectedActionRow],
    });
    await modalSubmitInteraction.editReply({
      content:
        `**Rejected** to grant the membership role <@&${roleId}> to <@${userId}>` +
        (reason.length > 0 ? ` for the following reason:\n\`\`\`\n${reason}\n\`\`\`` : '.') +
        (notified
          ? ''
          : '\nHowever, due to their __Privacy Settings__ of this server, **I cannot send DM to notify them.**\nThus, you might need to notify them yourself.'),
    });
  },
});

export default membershipRejectButton;
