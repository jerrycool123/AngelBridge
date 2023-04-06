import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ComponentType,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';

import { genericOption, upsertGuildConfig } from '../../libs/discord-util.js';
import { recognizeMembership } from '../../libs/membership.js';
import ocrWorker, { supportedOCRLanguages } from '../../libs/ocr.js';
import MembershipRole from '../../models/membership-role.js';
import User from '../../models/user.js';
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
    const [dbGuild, dbRoles, dbUser] = await Promise.all([
      upsertGuildConfig(guild),
      MembershipRole.find({ guild: guild.id }).populate<{
        youTubeChannel: YouTubeChannelDoc;
      }>('youTubeChannel'),
      User.findByIdAndUpdate(
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
    if (!dbGuild.allowedMembershipVerificationMethods.ocr) {
      await interaction.editReply({
        content:
          'This guild does not allow OCR verification.\nPlease contact the guild moderator to change this setting.',
      });
      return;
    } else if (!dbGuild.logChannel) {
      await interaction.editReply({
        content:
          'There is no log channel set up in this guild.\nPlease contact the guild moderator to set one up with `/set-log-channel` first.',
      });
      return;
    } else if (dbRoles.length === 0) {
      await interaction.editReply({
        content:
          'There is no membership role in this guild.\nPlease contact the guild moderator to set one up with `/add-role` first.',
      });
      return;
    }

    let selectedRoleId: string | null = null;
    let selectedLanguage = supportedOCRLanguages.find(
      ({ language }) => language === dbUser.language,
    ) ?? { language: 'English', code: 'eng' };
    const guildRoles = await guild.roles.fetch(undefined, { force: true });
    const roleOptions = dbRoles.map((role) => ({
      label: guildRoles.get(role._id)?.name ?? `<@&${role._id}>`,
      description: `${role.youTubeChannel.title} (${role.youTubeChannel.customUrl})`,
      value: role._id,
    }));
    const languageOptions = supportedOCRLanguages.map(({ language, code }) => ({
      label: language,
      value: code,
      default: code === selectedLanguage.code,
    }));

    const membershipRoleActionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('membership-roles')
        .setPlaceholder('Select a membership role')
        .addOptions(...roleOptions),
    );
    const languageActionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ocr-languages')
        .setPlaceholder('Select a language')
        .addOptions(...languageOptions),
    );
    const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('verify').setLabel('Verify').setStyle(ButtonStyle.Success),
    );

    const response = await interaction.editReply({
      content:
        'Please select a membership role and the language of the text in your picture.\n' +
        `__Selected language__: \`${selectedLanguage.language}\``,
      components: [membershipRoleActionRow, languageActionRow, buttonActionRow],
    });

    const stringSelectCollector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (stringSelectMenuInteraction) => user.id === stringSelectMenuInteraction.user.id,
      time: 5 * 60 * 1000,
    });

    stringSelectCollector.on('collect', async (stringSelectMenuInteraction) => {
      await stringSelectMenuInteraction.deferUpdate();

      const { customId } = stringSelectMenuInteraction;
      if (customId === 'membership-roles') {
        selectedRoleId =
          roleOptions.find(({ value }) => value === stringSelectMenuInteraction.values[0])?.value ??
          null;
        membershipRoleActionRow.components[0].setOptions(
          ...roleOptions.map((option) => ({
            ...option,
            default: option.value === selectedRoleId,
          })),
        );
      } else if (customId === 'ocr-languages') {
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
        content:
          'Please select a membership role and the language of the text in your picture.\n' +
          (selectedRoleId ? `__Selected role__: <@&${selectedRoleId}>\n` : '') +
          `__Selected language__: \`${selectedLanguage.language}\``,
        components: [membershipRoleActionRow, languageActionRow, buttonActionRow],
      });
    });

    let buttonInteraction: ButtonInteraction<CacheType> | undefined = undefined;
    try {
      buttonInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (buttonInteraction) => user.id === buttonInteraction.user.id,
        time: 60 * 1000,
      });
      buttonActionRow.components[0].setDisabled(true);
      await buttonInteraction.update({
        components: [buttonActionRow],
      });
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
    const role = dbRoles.find((role) => role._id === selectedRoleId);
    if (!role) {
      await buttonInteraction.followUp({
        content: 'Please select a membership role.',
        ephemeral: true,
      });
      return;
    }

    dbUser.language = selectedLanguage.language;
    await dbUser.save();

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
    await buttonInteraction.followUp({
      content:
        'After I finished parsing your picture,\n' +
        `It will be sent to the moderators of \`${guild.name}\` for further verification.\n` +
        'You will get a message when your role is applied.',
      ephemeral: true,
    });
  },
});

export default verify;
