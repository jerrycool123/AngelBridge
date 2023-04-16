import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';

import MembershipCollection, {
  OAuthMembershipDoc,
  OCRMembershipDoc,
} from '../../models/membership.js';
import DiscordBotConfig from '../config.js';
import { requireMembershipRoleDocumentWithYouTubeChannel } from '../utils/checker.js';
import { genericOption } from '../utils/common.js';
import { useGuildOnly } from '../utils/middleware.js';
import CustomBotCommand from './index.js';

dayjs.extend(utc);

const list_members = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('list-members')
    .setDescription('List all members with a specific membership role in this server')
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions)
    .addRoleOption(genericOption('role', 'The YouTube Membership role in this server', true)),
  execute: useGuildOnly(async (interaction) => {
    const { user, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Get membership role
    const role = options.getRole('role', true);
    const membershipRoleDoc = await requireMembershipRoleDocumentWithYouTubeChannel(
      interaction,
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

    const ocrEmbed = new EmbedBuilder()
      .setTitle(`Membership verified via OCR method`)
      .setDescription(
        `There are ${ocrMembershipDocs.length} members with the membership role <@&${role.id}> for the YouTube channel \`${membershipRoleDoc.youTubeChannel.title}\` in this server.`,
      )
      .addFields([
        {
          name: 'Member',
          value:
            ocrMembershipDocs.length === 0
              ? 'None'
              : ocrMembershipDocs
                  .slice(0, 10)
                  .map((ocrMembershipDoc) => `<@${ocrMembershipDoc.user}>`)
                  .join('\n'),
          inline: true,
        },
        {
          name: 'Next Billing Date',
          value:
            ocrMembershipDocs.length === 0
              ? 'None'
              : ocrMembershipDocs
                  .slice(0, 10)
                  .map((ocrMembershipDoc) =>
                    dayjs.utc(ocrMembershipDoc.billingDate).format('YYYY/MM/DD'),
                  )
                  .join('\n'),
          inline: true,
        },
      ])
      .setFooter({
        text: `Page: ${ocrMembershipPageIndex + 1}/${ocrMembershipPageCount}`,
      });
    const ocrActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('list-ocr-members-prev-button')
        .setLabel('<')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('list-ocr-members-next-button')
        .setLabel('>')
        .setStyle(ButtonStyle.Primary),
    );

    const ocrResponse = await interaction.editReply({
      content: `Following is the list of members with the role <@&${role.id}> for the YouTube channel \`${membershipRoleDoc.youTubeChannel.title}\``,
      embeds: [ocrEmbed],
      components: [ocrActionRow],
    });

    const ocrButtonCollector = ocrResponse.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (buttonInteraction) =>
        user.id === buttonInteraction.user.id &&
        ['list-ocr-members-prev-button', 'list-ocr-members-next-button'].includes(
          buttonInteraction.customId,
        ),
      time: 5 * 60 * 1000,
    });

    ocrButtonCollector.on('collect', async (buttonInteraction) => {
      const { customId } = buttonInteraction;
      if (customId === 'list-ocr-members-prev-button') {
        ocrMembershipPageIndex =
          (ocrMembershipPageIndex + ocrMembershipPageCount - 1) % ocrMembershipPageCount;
      } else if (customId === 'list-ocr-members-next-button') {
        ocrMembershipPageIndex = (ocrMembershipPageIndex + 1) % ocrMembershipPageCount;
      }
      const partialOcrMembershipDocs = ocrMembershipDocs.slice(
        ocrMembershipPageIndex * 10,
        (ocrMembershipPageIndex + 1) * 10,
      );

      ocrEmbed
        .setFields([
          {
            name: 'Member',
            value:
              partialOcrMembershipDocs.length === 0
                ? 'None'
                : partialOcrMembershipDocs

                    .map((ocrMembershipDoc) => `<@${ocrMembershipDoc.user}>`)
                    .join('\n'),
            inline: true,
          },
          {
            name: 'Next Billing Date',
            value:
              partialOcrMembershipDocs.length === 0
                ? 'None'
                : partialOcrMembershipDocs
                    .map((ocrMembershipDoc) =>
                      dayjs.utc(ocrMembershipDoc.billingDate).format('YYYY/MM/DD'),
                    )
                    .join('\n'),
            inline: true,
          },
        ])
        .setFooter({
          text: `Page: ${ocrMembershipPageIndex + 1}/${ocrMembershipPageCount}`,
        });
      await buttonInteraction.update({
        embeds: [ocrEmbed],
      });
    });

    const oauthEmbed = new EmbedBuilder()
      .setTitle(`Membership verified via OAuth method`)
      .setDescription(
        `There are ${oauthMembershipDocs.length} members with the membership role <@&${role.id}> for the YouTube channel \`${membershipRoleDoc.youTubeChannel.title}\` in this server.`,
      )
      .addFields([
        {
          name: 'Member',
          value:
            oauthMembershipDocs.length === 0
              ? 'None'
              : oauthMembershipDocs
                  .slice(0, 10)
                  .map((oauthMembershipDoc) => `<@${oauthMembershipDoc.user}>`)
                  .join('\n'),
          inline: true,
        },
        ...(oauthMembershipDocs.length > 10
          ? [
              {
                name: 'Member',
                value: oauthMembershipDocs
                  .slice(10, 20)
                  .map((oauthMembershipDoc) => `<@${oauthMembershipDoc.user}>`)
                  .join('\n'),
                inline: true,
              },
            ]
          : []),
      ])
      .setFooter({
        text: `Page: ${oauthMembershipPageIndex + 1}/${oauthMembershipPageCount}`,
      });
    const oauthActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('list-oauth-members-prev-button')
        .setLabel('<')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('list-oauth-members-next-button')
        .setLabel('>')
        .setStyle(ButtonStyle.Primary),
    );

    const oauthResponse = await interaction.followUp({
      embeds: [oauthEmbed],
      components: [oauthActionRow],
      ephemeral: true,
    });

    const oauthButtonCollector = oauthResponse.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (buttonInteraction) =>
        user.id === buttonInteraction.user.id &&
        ['list-oauth-members-prev-button', 'list-oauth-members-next-button'].includes(
          buttonInteraction.customId,
        ),
      time: 5 * 60 * 1000,
    });

    oauthButtonCollector.on('collect', async (buttonInteraction) => {
      const { customId } = buttonInteraction;
      if (customId === 'list-oauth-members-prev-button') {
        oauthMembershipPageIndex =
          (oauthMembershipPageIndex + oauthMembershipPageCount - 1) % oauthMembershipPageCount;
      } else if (customId === 'list-oauth-members-next-button') {
        oauthMembershipPageIndex = (oauthMembershipPageIndex + 1) % oauthMembershipPageCount;
      }
      const partialOauthMembershipDocs = oauthMembershipDocs.slice(
        oauthMembershipPageIndex * 20,
        (oauthMembershipPageIndex + 1) * 20,
      );

      oauthEmbed
        .setFields([
          {
            name: 'Member',
            value:
              partialOauthMembershipDocs.length === 0
                ? 'None'
                : partialOauthMembershipDocs
                    .slice(0, 10)
                    .map((oauthMembershipDoc) => `<@${oauthMembershipDoc.user}>`)
                    .join('\n'),
            inline: true,
          },
          ...(partialOauthMembershipDocs.length > 10
            ? [
                {
                  name: 'Member',
                  value: partialOauthMembershipDocs
                    .slice(10, 20)
                    .map((oauthMembershipDoc) => `<@${oauthMembershipDoc.user}>`)
                    .join('\n'),
                  inline: true,
                },
              ]
            : []),
        ])
        .setFooter({
          text: `Page: ${oauthMembershipPageIndex + 1}/${oauthMembershipPageCount}`,
        });

      await buttonInteraction.update({
        embeds: [oauthEmbed],
      });
    });
  }),
});

export default list_members;
