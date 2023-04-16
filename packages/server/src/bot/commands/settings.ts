import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';

import MembershipRoleCollection from '../../models/membership-role.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import DiscordBotConfig from '../config.js';
import { upsertGuildCollection } from '../utils/db.js';
import { useGuildOnly } from '../utils/middleware.js';
import CustomBotCommand from './index.js';

const settings = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Display guild settings')
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions),
  execute: useGuildOnly(async (interaction) => {
    const { guild, user } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Get guild config and membership roles
    const [guildConfig, membershipRoleDocs] = await Promise.all([
      upsertGuildCollection(guild),
      MembershipRoleCollection.find({ guild: guild.id }).populate<{
        youTubeChannel: YouTubeChannelDoc;
      }>('youTubeChannel'),
    ]);

    // Initialize buttons, embed, and action row
    const [allowOAuthButton, denyOAuthButton, allowOCRButton, denyOCRButton] = [
      new ButtonBuilder()
        .setCustomId('allow-oauth')
        .setLabel('Allow OAuth 2.0 Verification')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('deny-oauth')
        .setLabel('Deny OAuth 2.0 Verification')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('allow-ocr')
        .setLabel('Allow OCR Verification')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('deny-ocr')
        .setLabel('Deny OCR Verification')
        .setStyle(ButtonStyle.Danger),
    ];

    const settingsEmbed = new EmbedBuilder()
      .setAuthor({
        name: `${user.username}#${user.discriminator}`,
        iconURL: user.displayAvatarURL(),
      })
      .setTitle('Guild Settings')
      .setThumbnail(guild.iconURL())
      .addFields([
        {
          name: 'Guild name',
          value: guildConfig.name,
          inline: true,
        },
        {
          name: 'Guild ID',
          value: guildConfig._id,
          inline: true,
        },
        {
          name: 'Log channel',
          value: guildConfig.logChannel ? `<#${guildConfig.logChannel}>` : 'None',
        },
        {
          name: 'Allow OAuth 2.0 Verification',
          value: guildConfig.allowedMembershipVerificationMethods.oauth ? 'Yes' : 'No',
        },
        {
          name: 'Allow OCR Verification',
          value: guildConfig.allowedMembershipVerificationMethods.ocr ? 'Yes' : 'No',
        },
        {
          name: 'Membership Roles',
          value:
            membershipRoleDocs.length > 0
              ? membershipRoleDocs
                  .map(
                    ({ _id, youTubeChannel }) =>
                      `<@&${_id}> - [${youTubeChannel.title}](https://www.youtube.com/channel/${youTubeChannel._id}) ([${youTubeChannel.customUrl}](https://www.youtube.com/${youTubeChannel.customUrl}))`,
                  )
                  .join('\n')
              : 'None',
        },
      ])
      .setTimestamp()
      .setColor('Random')
      .setFooter({ text: `ID: ${user.id}` });

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      guildConfig.allowedMembershipVerificationMethods.oauth ? denyOAuthButton : allowOAuthButton,
      guildConfig.allowedMembershipVerificationMethods.ocr ? denyOCRButton : allowOCRButton,
    );

    // Send settings
    const response = await interaction.editReply({
      components: [actionRow],
      embeds: [settingsEmbed],
    });

    // Wait for button interaction and update settings
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (buttonInteraction) => buttonInteraction.user.id === user.id,
      time: 60 * 1000,
    });

    collector.on('collect', async (buttonInteraction) => {
      await buttonInteraction.deferUpdate();
      if (buttonInteraction.customId === 'allow-ocr') {
        guildConfig.allowedMembershipVerificationMethods.ocr = true;
      } else if (buttonInteraction.customId === 'deny-ocr') {
        guildConfig.allowedMembershipVerificationMethods.ocr = false;
      } else if (buttonInteraction.customId === 'allow-oauth') {
        guildConfig.allowedMembershipVerificationMethods.oauth = true;
      } else if (buttonInteraction.customId === 'deny-oauth') {
        guildConfig.allowedMembershipVerificationMethods.oauth = false;
      }
      await guildConfig.save();

      actionRow.setComponents(
        guildConfig.allowedMembershipVerificationMethods.oauth ? denyOAuthButton : allowOAuthButton,
        guildConfig.allowedMembershipVerificationMethods.ocr ? denyOCRButton : allowOCRButton,
      );

      const ocrFieldIndex =
        settingsEmbed.data.fields?.findIndex((field) => field.name === 'Allow OCR Verification') ??
        -1;
      const oauthFieldIndex =
        settingsEmbed.data.fields?.findIndex(
          (field) => field.name === 'Allow OAuth 2.0 Verification',
        ) ?? -1;
      if (ocrFieldIndex === -1 || oauthFieldIndex === -1) {
        collector.stop();
        return;
      }

      const newFields = [...(settingsEmbed.data.fields ?? [])];
      newFields[ocrFieldIndex].value = guildConfig.allowedMembershipVerificationMethods.ocr
        ? 'Yes'
        : 'No';
      newFields[oauthFieldIndex].value = guildConfig.allowedMembershipVerificationMethods.oauth
        ? 'Yes'
        : 'No';
      settingsEmbed.setFields(newFields);

      await buttonInteraction.editReply({
        components: [actionRow],
        embeds: [settingsEmbed],
      });
    });

    collector.on('end', async () => {
      actionRow.setComponents(
        ...actionRow.components.map((component) => component.setDisabled(true)),
      );
      await interaction.editReply({
        components: [actionRow],
      });
    });
  }),
});

export default settings;
