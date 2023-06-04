import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ComponentType,
  SlashCommandBuilder,
} from 'discord.js';

import DBChecker from '../../../checkers/db.js';
import MembershipRoleCollection, { MembershipRoleDoc } from '../../../models/membership-role.js';
import MembershipCollection from '../../../models/membership.js';
import { YouTubeChannelDoc } from '../../../models/youtube-channel.js';
import { OCRConfig, OCRService } from '../../../services/ocr/index.js';
import { Bot, BotCommandTrigger, BotErrorConfig } from '../../../types/bot.js';
import { DBUtils } from '../../../utils/db.js';
import { MethodNotAllowedError } from '../../../utils/error.js';
import { BadRequestError } from '../../../utils/error.js';
import { NotFoundError } from '../../../utils/error.js';
import { RequestTimeoutError } from '../../../utils/error.js';
import { BotActionRows, BotEmbeds } from '../../components/index.js';
import { BotCheckers, BotCommonUtils } from '../../utils/index.js';

export class VerifyCommandTrigger implements BotCommandTrigger<false> {
  public readonly data = new SlashCommandBuilder()
    .setName('verify')
    .setDescription(
      'Verify your YouTube membership and request access to the membership role in this server.',
    )
    .setDMPermission(true)
    .addGenericAttachmentOption('picture', 'Picture to OCR', true);
  public readonly guildOnly = false;
  public readonly botHasManageRolePermission = false;
  private readonly ocrService = new OCRService();

  public async execute(
    bot: Bot,
    interaction: ChatInputCommandInteraction,
    errorConfig: BotErrorConfig,
  ): Promise<void> {
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
      DBUtils.upsertGuild({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL(),
      }),
      DBUtils.upsertUser(BotCommonUtils.getUserMeta(user)),
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
    let selectedLanguage = OCRConfig.supportedLanguages.find(
      ({ name }) => name === userDoc.language,
    ) ?? { name: 'English', code: 'eng' };
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
    const languageOptions = OCRConfig.supportedLanguages.map(({ name, code }) => ({
      label: name,
      value: code,
      default: code === selectedLanguage.code,
    }));

    const membershipRoleActionRow = BotActionRows.createSelectionActionRow(
      'verify-membership-roles-menu',
      'Select a membership role',
      roleOptions,
    );
    const languageActionRow = BotActionRows.createSelectionActionRow(
      'ocr-languages-menu',
      'Select a language',
      languageOptions,
    );
    const buttonActionRow = BotActionRows.createSuccessActionRow('verify-button', 'Verify');

    const response = await interaction.genericReply({
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
        selectedLanguage = OCRConfig.supportedLanguages.find(
          ({ code }) => code === stringSelectMenuInteraction.values[0],
        ) ?? {
          name: 'English',
          code: 'eng',
        };
        languageActionRow.components[0].setOptions(
          ...languageOptions.map((option) => ({
            ...option,
            default: option.value === selectedLanguage.code,
          })),
        );
      }
      await stringSelectMenuInteraction.genericReply({
        components: [membershipRoleActionRow, languageActionRow, buttonActionRow],
      });
    });

    // Wait for user to click the verify button
    let buttonInteraction: ButtonInteraction | null = null;
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
      await interaction.genericReply({
        components: [],
      });
      throw new RequestTimeoutError('Timed out. Please try again.');
    }
    let prevInteraction = buttonInteraction;
    await prevInteraction.deferReply({ ephemeral: true });
    const membershipRoleDoc = membershipRoleDocs.find((role) => role._id === selectedRoleId);
    if (membershipRoleDoc === undefined) {
      errorConfig.activeInteraction = prevInteraction;
      throw new BadRequestError('Please select a membership role.');
    }

    // Disable verify button
    membershipRoleActionRow.components[0].setDisabled(true);
    languageActionRow.components[0].setDisabled(true);
    buttonActionRow.components[0].setDisabled(true);
    await interaction.genericReply({
      components: [membershipRoleActionRow, languageActionRow, buttonActionRow],
    });

    // Check if the user already has OAuth membership
    const oauthMembershipDoc = await MembershipCollection.findOne({
      type: 'oauth',
      user: user.id,
      membershipRole: selectedRoleId,
    });
    if (oauthMembershipDoc !== null) {
      prevInteraction = await BotCommonUtils.awaitUserConfirm(
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
    userDoc.language = selectedLanguage.name;
    await userDoc.save();

    // Send response to user
    const membershipVerificationRequestSubmissionEmbed =
      BotEmbeds.createMembershipVerificationRequestSubmissionEmbed(
        user,
        membershipRoleDoc,
        selectedLanguage.name,
        guild.name,
        picture.url,
      );
    await prevInteraction.genericReply({
      embeds: [membershipVerificationRequestSubmissionEmbed],
    });

    // Send picture to membership service for OCR
    // ? Do not send error to user if OCR failed due to errors that are not related to the user
    try {
      const { logChannel: logChannelId } = await DBChecker.requireGuildWithLogChannel(guild.id);
      const logChannel = await BotCheckers.requireGuildHasLogChannel(bot, guild, logChannelId);

      const recognizedDate = await this.ocrService.recognizeBillingDate(
        picture.url,
        selectedLanguage.code,
      );

      const adminActionRow = BotActionRows.createAdminVerificationActionRow();
      const membershipVerificationRequestEmbed = BotEmbeds.createMembershipVerificationRequestEmbed(
        user,
        recognizedDate,
        membershipRoleDoc._id,
        selectedLanguage.code,
        picture.url,
      );

      await logChannel.send({
        components: [adminActionRow],
        embeds: [membershipVerificationRequestEmbed],
      });
    } catch (error) {
      console.error(error);
    }
  }
}
