import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  Role,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ModalSubmitInteraction } from 'discord.js';

import { BotChecker } from '../../checkers/bot.js';
import { RequestTimeoutError } from '../../libs/error.js';
import { BotButton, BotErrorConfig, GuildButtonInteraction } from '../../types/bot.js';
import { createDisabledRejectedActionRow } from '../utils/common.js';
import { parseMembershipVerificationRequestEmbed } from '../utils/membership.js';

export class MembershipRejectButton implements BotButton<true> {
  public readonly customId = 'membership-reject';
  public readonly data = new ButtonBuilder()
    .setCustomId(this.customId)
    .setStyle(ButtonStyle.Danger)
    .setLabel('Reject');
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = false;
  public readonly userHasManageRolePermission = true;

  public async execute(
    interaction: GuildButtonInteraction,
    errorConfig: BotErrorConfig,
  ): Promise<void> {
    errorConfig.followUp = true;
    const { guild, user: moderator } = interaction;

    // Create reject modal
    const rejectModal = new ModalBuilder()
      .setCustomId(`membership-reject-modal-${interaction.id}`)
      .setTitle('Reject Membership Request')
      .addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('membership-reject-reason-input')
            .setLabel('Reason (this will be sent to the user)')
            .setPlaceholder('We cannot recognize your picture...')
            .setStyle(TextInputStyle.Short)
            .setRequired(false),
        ),
      );
    await interaction.showModal(rejectModal);

    // Parse embed
    const { infoEmbed, userId, roleId } = await parseMembershipVerificationRequestEmbed(
      interaction,
      interaction.message.embeds[0] ?? null,
      errorConfig,
    );

    // We don't check if the role is valid because it's a reject action
    let role: Role | null = null;
    try {
      role = await BotChecker.requireRole(guild, roleId);
    } catch (error) {
      // Role does not exist
    }

    // Fetch guild member
    const member = await BotChecker.requireGuildMember(guild, userId, false);

    // Receive rejection reason from the modal
    let modalSubmitInteraction: ModalSubmitInteraction | null = null;
    try {
      modalSubmitInteraction = await interaction.awaitModalSubmit({
        filter: (modalSubmitInteraction) =>
          moderator.id === modalSubmitInteraction.user.id &&
          modalSubmitInteraction.customId === `membership-reject-modal-${interaction.id}`,
        time: 60 * 1000,
      });
    } catch (error) {
      // Timeout
    }
    if (modalSubmitInteraction === null) {
      throw new RequestTimeoutError('Timed out. Please try again.');
    }
    const reason = modalSubmitInteraction.fields.getTextInputValue(
      'membership-reject-reason-input',
    );

    // Acknowledge the modal
    await modalSubmitInteraction.deferUpdate();

    // DM the user
    let notified = false;
    try {
      await member.send({
        content:
          `You have been rejected to be granted the membership role **${
            role !== null ? `@${role.name}` : `<@&${roleId}>`
          }** in the server \`${guild.name}\`.` +
          (reason.length > 0 ? `\nReason: \`\`\`\n${reason}\n\`\`\`` : ''),
      });
      notified = true;
    } catch (error) {
      // User does not allow DMs
    }

    // Mark the request as rejected
    const rejectedActionRow = createDisabledRejectedActionRow();
    await interaction.message.edit({
      content: notified
        ? ''
        : "**[NOTE]** Due to the user's __Privacy Settings__ of this server, **I cannot send DM to notify them.**\nYou might need to notify them yourself.",
      embeds: [
        EmbedBuilder.from(infoEmbed.data)
          .setTitle('❌ [Rejected] ' + (infoEmbed.title ?? ''))
          .addFields([
            {
              name: 'Rejected By',
              value: `<@${moderator.id}>`,
              inline: true,
            },
            {
              name: 'Reason',
              value: reason.length > 0 ? reason : 'None',
            },
          ])
          .setColor('#ED4245'),
      ],
      components: [rejectedActionRow],
    });
  }
}
