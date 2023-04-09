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

import { genericOption, upsertGuildConfig } from '../../libs/discord-util.js';
import { recognizeMembership } from '../../libs/membership.js';
import ocrWorker, { supportedOCRLanguages } from '../../libs/ocr.js';
import MembershipRoleCollection from '../../models/membership-role.js';
import UserCollection from '../../models/user.js';
import { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import CustomBotCommand from './index.js';

const verify = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription(
      'Verify your YouTube membership and request access to the membership role in this guild.',
    )
    .setDMPermission(true)
    .addAttachmentOption(genericOption('picture', 'Picture to OCR', true)),

  async execute(interaction) {
    const { guild, user, options } = interaction;
    if (!guild) {
      await interaction.reply({
        content:
          'This command can only be used in a guild.\nHowever, we are developing a DM version of this command. Stay tuned!',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const picture = options.getAttachment('picture', true);
    if (!picture.contentType?.startsWith('image/')) {
      await interaction.editReply({
        content: 'Please provide an image file.',
      });
      return;
    }
    const [guildDoc, membershipRoleDocs, userDoc] = await Promise.all([
      upsertGuildConfig(guild),
      MembershipRoleCollection.find({ guild: guild.id }).populate<{
        youTubeChannel: YouTubeChannelDoc;
      }>('youTubeChannel'),
      UserCollection.findByIdAndUpdate(
        user.id,
        {
          $set: {
            username: `${user.username}#${user.discriminator}`,
            avatar: user.displayAvatarURL(),
          },
          $setOnInsert: { _id: user.id },
        },
        {
          upsert: true,
          new: true,
        },
      ),
    ]);
    if (!guildDoc.allowedMembershipVerificationMethods.ocr) {
      await interaction.editReply({
        content:
          'This guild does not allow OCR verification.\nPlease contact the guild moderator to change this setting.',
      });
      return;
    } else if (!guildDoc.logChannel) {
      await interaction.editReply({
        content:
          'There is no log channel set up in this guild.\nPlease contact the guild moderator to set one up with `/set-log-channel` first.',
      });
      return;
    } else if (membershipRoleDocs.length === 0) {
      await interaction.editReply({
        content:
          'There is no membership role in this guild.\nPlease contact the guild moderator to set one up with `/add-role` first.',
      });
      return;
    }

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
        content: 'Timed out. Please try again.',
        components: [],
      });
      return;
    }
    const role = membershipRoleDocs.find((role) => role._id === selectedRoleId);
    if (!role) {
      await buttonInteraction.followUp({
        content: 'Please select a membership role.',
        ephemeral: true,
      });
      return;
    }

    userDoc.lastVerifyingRoleId = selectedRoleId;
    userDoc.language = selectedLanguage.language;
    await userDoc.save();

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
