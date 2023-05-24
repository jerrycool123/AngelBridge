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

import DBChecker from '../checkers/db.js';
import { MethodNotAllowedError } from '../libs/error.js';
import { BadRequestError } from '../libs/error.js';
import { NotFoundError } from '../libs/error.js';
import { RequestTimeoutError } from '../libs/error.js';
import ocrWorker, { supportedOCRLanguages } from '../libs/ocr.js';
import MembershipRoleCollection, { MembershipRoleDoc } from '../models/membership-role.js';
import MembershipCollection from '../models/membership.js';
import { YouTubeChannelDoc } from '../models/youtube-channel.js';
import { genericOption } from '../utils/common.js';
import awaitConfirm from '../utils/confirm.js';
import { upsertGuildCollection, upsertUserCollection } from '../utils/db.js';
import { recognizeMembership } from '../utils/membership.js';
import CustomBotCommand from './index.js';

const verify = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription(
      'Verify your YouTube membership and request access to the membership role in this server.',
    )
    .setDMPermission(true)
    .addAttachmentOption(genericOption('picture', 'Picture to OCR', true)),
  async execute(interaction, errorConfig) {
    const { guild, user, options } = interaction;
    if (guild === null) {
      throw new MethodNotAllowedError(
        'This command can only be used in a server.\n' +
          'However, we are developing a DM version of this command. Stay tuned!',
      );
    }

    await interaction.deferReply({ ephemeral: true });

    // Get user attachment
    const picture = options.getAttachment('picture', true);
    if (!(picture.contentType?.startsWith('image/') ?? false)) {
      throw new BadRequestError('Please provide an image file.');
    }

    // Upsert guild and user config, get membership roles
    const [guildDoc, userDoc, membershipRoleDocs] = await Promise.all([
      upsertGuildCollection(guild),
      upsertUserCollection(user, user.displayAvatarURL()),
      MembershipRoleCollection.find({ guild: guild.id }).populate<{
        youTubeChannel: YouTubeChannelDoc | null;
      }>('youTubeChannel'),
    ]);

    // Log channel and membership role checks
    await DBChecker.requireGuildWithLogChannel(guildDoc);
    if (membershipRoleDocs.length === 0) {
      throw new NotFoundError(
        'There is no membership role in this server.\n' +
          'A server moderator can set one up with `/add-role` first.',
      );
    }

    // Initialize action rows, buttons and menus
    let selectedRoleId =
      membershipRoleDocs.find((role) => role._id === userDoc.lastVerifyingRoleId)?._id ?? null;
    let selectedLanguage = supportedOCRLanguages.find(
      ({ language }) => language === userDoc.language,
    ) ?? { language: 'English', code: 'eng' };
    const roleOptions = membershipRoleDocs
      .filter(
        (
          membershipRoleDoc,
        ): membershipRoleDoc is Omit<MembershipRoleDoc, 'youTubeChannel'> & {
          youTubeChannel: YouTubeChannelDoc;
        } => membershipRoleDoc.youTubeChannel !== null,
      )
      .map(({ _id, name, youTubeChannel }) => ({
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
    let buttonInteraction: ButtonInteraction<CacheType> | null = null;
    try {
      buttonInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (buttonInteraction) =>
          user.id === buttonInteraction.user.id && buttonInteraction.customId === 'verify-button',
        time: 60 * 1000,
      });
    } catch (error) {
      // Timeout
    }
    if (buttonInteraction === null) {
      await interaction.editReply({
        components: [],
      });
      throw new RequestTimeoutError('Timed out. Please try again.');
    }
    let prevInteraction = buttonInteraction;
    await prevInteraction.deferReply({ ephemeral: true });
    const role = membershipRoleDocs.find((role) => role._id === selectedRoleId);
    if (role === undefined) {
      errorConfig.activeInteraction = prevInteraction;
      throw new BadRequestError('Please select a membership role.');
    }

    // Disable verify button
    membershipRoleActionRow.components[0].setDisabled(true);
    languageActionRow.components[0].setDisabled(true);
    buttonActionRow.components[0].setDisabled(true);
    await interaction.editReply({
      components: [membershipRoleActionRow, languageActionRow, buttonActionRow],
    });

    // Check if the user already has OAuth membership
    const oauthMembershipDoc = await MembershipCollection.findOne({
      type: 'oauth',
      user: user.id,
      membershipRole: selectedRoleId,
    });
    if (oauthMembershipDoc !== null) {
      prevInteraction = await awaitConfirm(
        prevInteraction,
        'verify-detected-oauth',
        {
          content:
            'You already have an OAuth membership with this membership role.\n' +
            'If your OCR request is accepted, your OAuth membership will be overwritten. Do you want to continue?',
        },
        errorConfig,
      );
      await prevInteraction.deferReply({ ephemeral: true });
    }

    // Save user config to DB
    userDoc.lastVerifyingRoleId = selectedRoleId;
    userDoc.language = selectedLanguage.language;
    await userDoc.save();

    // Send picture to OCR worker
    void ocrWorker.queue.add(async () =>
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
    await prevInteraction.editReply({
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
    });
  },
});

export default verify;
