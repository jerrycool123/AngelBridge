import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';

import ocrWorker, { supportedOCRLanguages } from '../../libs/ocr.js';
import MembershipRoleCollection from '../../models/membership-role.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import { genericOption } from '../utils/common.js';
import { upsertGuildCollection, upsertUserCollection } from '../utils/db.js';
import { CustomError } from '../utils/error.js';
import { recognizeMembership } from '../utils/membership.js';
import {
  requireGuildDocumentAllowOCR,
  requireGuildDocumentHasLogChannel,
} from '../utils/validator.js';
import CustomBotCommand from './index.js';

const verify = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription(
      'Verify your YouTube membership and request access to the membership role in this server.',
    )
    .setDMPermission(true)
    .addAttachmentOption(genericOption('picture', 'Picture to OCR', true)),
  async execute(interaction) {
    const { guild, user, options } = interaction;
    if (!guild) {
      throw new CustomError(
        'This command can only be used in a server.\n' +
          'However, we are developing a DM version of this command. Stay tuned!',
        interaction,
      );
    }

    await interaction.deferReply({ ephemeral: true });

    // Get user attachment
    const picture = options.getAttachment('picture', true);
    if (!picture.contentType?.startsWith('image/')) {
      throw new CustomError('Please provide an image file.', interaction);
    }

    // Upsert guild and user config, get membership roles
    const [guildDoc, userDoc, membershipRoleDocs] = await Promise.all([
      upsertGuildCollection(guild),
      upsertUserCollection(user),
      MembershipRoleCollection.find({ guild: guild.id }).populate<{
        youTubeChannel: YouTubeChannelDoc;
      }>('youTubeChannel'),
    ]);

    // Guild and membership role checks
    requireGuildDocumentAllowOCR(interaction, guildDoc);
    requireGuildDocumentHasLogChannel(interaction, guildDoc);
    if (membershipRoleDocs.length === 0) {
      throw new CustomError(
        'There is no membership role in this server.\n' +
          'A server moderator can set one up with `/add-role` first.',
        interaction,
      );
    }

    // Initialize action rows, buttons and menus
    let selectedRoleId =
      membershipRoleDocs.find((role) => role._id === userDoc.lastVerifyingRoleId)?._id ?? null;
    let selectedLanguage = supportedOCRLanguages.find(
      ({ language }) => language === userDoc.language,
    ) ?? { language: 'English', code: 'eng' };
    const roleOptions = membershipRoleDocs.map(({ _id, name, youTubeChannel }) => ({
      label: name,
      description: `${youTubeChannel.title} (${youTubeChannel.customUrl})`,
      value: _id,
      default: _id === selectedRoleId,
    }));
    const languageOptions = supportedOCRLanguages.map(({ language, code }) => ({
      label: language,
      value: code,
      default: code === selectedLanguage.code,
    }));

    const membershipRoleActionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('verify-membership-roles-menu')
        .setPlaceholder('Select a membership role')
        .addOptions(...roleOptions),
    );
    const languageActionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ocr-languages-menu')
        .setPlaceholder('Select a language')
        .addOptions(...languageOptions),
    );
    const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('verify-button')
        .setLabel('Verify')
        .setStyle(ButtonStyle.Success),
    );

    const response = await interaction.editReply({
      content: 'Please select a membership role and the language of the text in your picture.',
      components: [membershipRoleActionRow, languageActionRow, buttonActionRow],
    });

    // Wait for user to select a membership role and language
    const stringSelectCollector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (stringSelectMenuInteraction) =>
        user.id === stringSelectMenuInteraction.user.id &&
        ['verify-membership-roles-menu', 'ocr-languages-menu'].includes(
          stringSelectMenuInteraction.customId,
        ),
      time: 5 * 60 * 1000,
    });

    stringSelectCollector.on('collect', async (stringSelectMenuInteraction) => {
      await stringSelectMenuInteraction.deferUpdate();

      const { customId } = stringSelectMenuInteraction;
      if (customId === 'verify-membership-roles-menu') {
        selectedRoleId =
          roleOptions.find(({ value }) => value === stringSelectMenuInteraction.values[0])?.value ??
          null;
        membershipRoleActionRow.components[0].setOptions(
          ...roleOptions.map((option) => ({
            ...option,
            default: option.value === selectedRoleId,
          })),
        );
      } else if (customId === 'ocr-languages-menu') {
        selectedLanguage = supportedOCRLanguages.find(
          ({ code }) => code === stringSelectMenuInteraction.values[0],
        ) ?? {
          language: 'English',
          code: 'eng',
        };
        languageActionRow.components[0].setOptions(
          ...languageOptions.map((option) => ({
            ...option,
            default: option.value === selectedLanguage.code,
          })),
        );
      }
      await stringSelectMenuInteraction.editReply({
        components: [membershipRoleActionRow, languageActionRow, buttonActionRow],
      });
    });

    // Wait for user to click the verify button
    let buttonInteraction: ButtonInteraction<CacheType> | undefined = undefined;
    try {
      buttonInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (buttonInteraction) =>
          user.id === buttonInteraction.user.id && buttonInteraction.customId === 'verify-button',
        time: 60 * 1000,
      });
      await buttonInteraction.deferUpdate();
    } catch (error) {
      // Timeout
    }
    if (!buttonInteraction) {
      await interaction.editReply({
        components: [],
      });
      throw new CustomError('Timed out. Please try again.', interaction);
    }
    const role = membershipRoleDocs.find((role) => role._id === selectedRoleId);
    if (!role) {
      throw new CustomError('Please select a membership role.', buttonInteraction);
    }

    // Save user config to DB
    userDoc.lastVerifyingRoleId = selectedRoleId;
    userDoc.language = selectedLanguage.language;
    await userDoc.save();

    // Send picture to OCR worker
    ocrWorker.addJob(
      recognizeMembership(
        guild.id,
        selectedLanguage.code,
        {
          id: user.id,
          username: `${user.username}#${user.discriminator}`,
          avatar: user.displayAvatarURL(),
        },
        picture.url,
        role._id,
      ),
    );

    // Send response to user
    await buttonInteraction.editReply({
      content: '',
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: userDoc.username,
            iconURL: userDoc.avatar,
          })
          .setTitle('Membership Verification Request Submitted')
          .setDescription(
            'After I finished recognizing your picture, ' +
              'it will be sent to the moderators of the server for further verification.\n' +
              'You will get a message when your role is applied.',
          )
          .addFields([
            {
              name: 'Membership Role',
              value: `<@&${role._id}>`,
              inline: true,
            },
            {
              name: 'Language',
              value: selectedLanguage.language,
              inline: true,
            },
            {
              name: 'Discord Server',
              value: guild.name,
              inline: true,
            },
          ])
          .setImage(picture.url)
          .setColor(role.color)
          .setTimestamp()
          .setFooter({ text: `ID: ${user.id}` }),
      ],
      components: [],
    });
  },
});

export default verify;
