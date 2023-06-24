import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { ComponentType, SlashCommandBuilder } from 'discord.js';

import DBChecker from '../../../checkers/db.js';
import MembershipCollection, {
  OAuthMembershipDoc,
  OCRMembershipDoc,
} from '../../../models/membership.js';
import { Bot, BotCommandTrigger, GuildChatInputCommandInteraction } from '../../../types/bot.js';
import { BotActionRows } from '../../components/action-rows.js';
import { BotEmbeds } from '../../components/embeds.js';
import { BotConstants } from '../../constants.js';

dayjs.extend(utc);

export class ListMembersCommandTrigger implements BotCommandTrigger<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('list-members')
    .setDescription('List all members with a specific membership role in this server')
    .setDefaultMemberPermissions(BotConstants.ModeratorPermissions)
    .addGenericRoleOption('role', 'The YouTube Membership role in this server', true);
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = false;

  public async execute(
    bot: Bot<true>,
    interaction: GuildChatInputCommandInteraction,
  ): Promise<void> {
    const { guild, user, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Get membership role
    const role = options.getRole('role', true);
    const membershipRoleDoc = await DBChecker.requireMembershipRoleWithYouTubeChannel(
      guild.id,
      role.id,
    );

    // Get all members with the membership role
    const membershipDocs = await MembershipCollection.find({
      membershipRole: membershipRoleDoc._id,
    });
    const ocrMembershipDocs: OCRMembershipDoc[] = [],
      oauthMembershipDocs: OAuthMembershipDoc[] = [];
    for (const membershipDoc of membershipDocs) {
      if (membershipDoc.type === 'ocr') {
        ocrMembershipDocs.push(membershipDoc as OCRMembershipDoc);
      } else {
        oauthMembershipDocs.push(membershipDoc as OAuthMembershipDoc);
      }
    }

    let ocrMembershipPageIndex = 0,
      oauthMembershipPageIndex = 0;
    const ocrMembershipPageCount =
      ocrMembershipDocs.length === 0 ? 1 : Math.ceil(ocrMembershipDocs.length / 10);
    const oauthMembershipPageCount =
      oauthMembershipDocs.length === 0 ? 1 : Math.ceil(oauthMembershipDocs.length / 20);

    const ocrMembershipListEmbed = BotEmbeds.createOCRMembershipListEmbed(
      ocrMembershipDocs,
      membershipRoleDoc,
      ocrMembershipPageIndex,
    );

    const [ocrPrevCustomId, ocrNextCustomId] = [
      'list-ocr-members-prev-button',
      'list-ocr-members-next-button',
    ];
    const ocrPaginationActionRow = BotActionRows.createPaginationActionRow(
      ocrPrevCustomId,
      ocrNextCustomId,
    );

    const ocrResponse = await interaction.genericReply({
      embeds: [ocrMembershipListEmbed],
      components: [ocrPaginationActionRow],
    });

    const ocrButtonCollector = ocrResponse.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (buttonInteraction) =>
        user.id === buttonInteraction.user.id &&
        [ocrPrevCustomId, ocrNextCustomId].includes(buttonInteraction.customId),
      time: 5 * 60 * 1000,
    });

    ocrButtonCollector.on('collect', async (buttonInteraction) => {
      const { customId } = buttonInteraction;
      if (customId === ocrPrevCustomId) {
        ocrMembershipPageIndex =
          (ocrMembershipPageIndex + ocrMembershipPageCount - 1) % ocrMembershipPageCount;
      } else if (customId === ocrNextCustomId) {
        ocrMembershipPageIndex = (ocrMembershipPageIndex + 1) % ocrMembershipPageCount;
      }

      const updatedOCRMembershipListEmbed = BotEmbeds.createOCRMembershipListEmbed(
        ocrMembershipDocs,
        membershipRoleDoc,
        ocrMembershipPageIndex,
      );
      await buttonInteraction.update({
        embeds: [updatedOCRMembershipListEmbed],
      });
    });

    const oauthMembershipListEmbed = BotEmbeds.createOAuthMembershipListEmbed(
      oauthMembershipDocs,
      membershipRoleDoc,
      oauthMembershipPageIndex,
    );

    const [oauthPrevCustomId, oauthNextCustomId] = [
      'list-oauth-members-prev-button',
      'list-oauth-members-next-button',
    ];
    const oauthPaginationActionRow = BotActionRows.createPaginationActionRow(
      oauthPrevCustomId,
      oauthNextCustomId,
    );

    const oauthResponse = await interaction.genericReply({
      embeds: [oauthMembershipListEmbed],
      components: [oauthPaginationActionRow],
      ephemeral: true,
      followUp: true,
    });

    const oauthButtonCollector = oauthResponse.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (buttonInteraction) =>
        user.id === buttonInteraction.user.id &&
        [oauthPrevCustomId, oauthNextCustomId].includes(buttonInteraction.customId),
      time: 5 * 60 * 1000,
    });

    oauthButtonCollector.on('collect', async (buttonInteraction) => {
      const { customId } = buttonInteraction;
      if (customId === oauthPrevCustomId) {
        oauthMembershipPageIndex =
          (oauthMembershipPageIndex + oauthMembershipPageCount - 1) % oauthMembershipPageCount;
      } else if (customId === oauthNextCustomId) {
        oauthMembershipPageIndex = (oauthMembershipPageIndex + 1) % oauthMembershipPageCount;
      }

      BotEmbeds.createOAuthMembershipListEmbed(
        oauthMembershipDocs,
        membershipRoleDoc,
        oauthMembershipPageIndex,
      );

      await buttonInteraction.update({
        embeds: [oauthMembershipListEmbed],
      });
    });
  }
}
