import { EmbedBuilder } from 'discord.js';
import { ModalSubmitInteraction } from 'discord.js';

import {
  Bot,
  BotButtonTrigger,
  BotErrorConfig,
  GuildButtonInteraction,
} from '../../../types/bot.js';
import { NotFoundError, RequestTimeoutError } from '../../../utils/error.js';
import { BotActionRows, BotEmbeds, BotModals } from '../../components/index.js';
import { BotConstants } from '../../constants.js';
import { BotCheckers } from '../../utils/index.js';

export class MembershipRejectButtonTrigger implements BotButtonTrigger<true> {
  public readonly customId = BotConstants.AdminMembershipVerificationActionId.reject;
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = false;
  public readonly userHasManageRolePermission = true;

  public async execute(
    bot: Bot<true>,
    interaction: GuildButtonInteraction,
    errorConfig: BotErrorConfig,
  ): Promise<void> {
    errorConfig.followUp = true;
    const { guild, user: moderator } = interaction;

    // Create reject modal
    const modalCustomId = `membership-reject-modal-${interaction.id}`;
    const modalInputCustomId = 'membership-reject-reason-input';
    const rejectModal = BotModals.createRejectionModal(modalCustomId, modalInputCustomId);
    await interaction.showModal(rejectModal);

    // Parse embed
    const { infoEmbed, userId, roleId } = await BotEmbeds.parseMembershipVerificationRequestEmbed(
      interaction,
      interaction.message.embeds[0] ?? null,
      errorConfig,
    );

    // We don't check if the role is valid because it's a reject action
    const role = await BotCheckers.fetchRole(guild, roleId);

    // Fetch guild member
    const member = await BotCheckers.fetchGuildMember(guild, userId, false);
    if (member === null) {
      throw new NotFoundError(`The user <@${userId}> is not a member of the server.`);
    }

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
    const rejectedActionRow = BotActionRows.createDisabledRejectedActionRow();
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
