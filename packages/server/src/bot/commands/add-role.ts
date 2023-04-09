import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ComponentType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import { genericOption, replyGuildOnly } from '../../libs/discord-util.js';
import MembershipRoleCollection from '../../models/membership-role.js';
import YouTubeChannelCollection, { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import DiscordBotConfig from '../config.js';
import CustomBotCommand from './index.js';

const add_role = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('add-role')
    .setDescription('Add a YouTube membership role in this guild')
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions)
    .addStringOption(genericOption('keyword', "The YouTube channel's ID, name or custom URL", true))
    .addRoleOption(genericOption('role', 'The YouTube Membership role in this guild', true)),
  async execute(interaction) {
    const { guild, user, options } = interaction;
    if (!guild) {
      await replyGuildOnly(interaction);
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    // Handle role checks
    const botMember = await guild.members.fetchMe({ force: true });
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.editReply({
        content: `The bot does not have the \`Manage Roles\` permission.\nPlease try again after giving the bot the permission.`,
      });
      return;
    }

    const role = options.getRole('role', true);
    if (role.id === guild.id) {
      await interaction.editReply({
        content: `You cannot assign @everyone role to users.\nPlease try again with a valid role.`,
      });
      return;
    } else if (botMember.roles.highest.comparePositionTo(role.id) <= 0) {
      await interaction.editReply({
        content: `Due to the role hierarchy, the bot cannot assign the role <@&${role.id}> to users.\nI can only assign a role whose order is lower than that of my highest role highest role <@&${botMember.roles.highest.id}>.`,
      });
      return;
    }

    const keyword = options.getString('keyword', true);
    const youTubeChannelDocs = await YouTubeChannelCollection.find({
      $or: [
        { _id: { $regex: keyword, $options: 'i' } },
        { title: { $regex: keyword, $options: 'i' } },
        { customUrl: { $regex: keyword, $options: 'i' } },
      ],
    });

    if (youTubeChannelDocs.length === 0) {
      await interaction.editReply({
        content: `Could not find any registered YouTube channel for the keyword: \`${keyword}\`. Please try again or use \`/add-yt-channel\` to register the channel first.`,
      });
      return;
    } else if (youTubeChannelDocs.length > 1) {
      await interaction.editReply({
        content:
          `Found multiple registered YouTube channels for the keyword: \`${keyword}\`. Please try again with a more specific keyword.\n` +
          `Found channels:\n` +
          youTubeChannelDocs
            .map((channel) => `\`${channel.title}\`: \`${channel._id}\` (\`${channel.customUrl}\`)`)
            .join('\n'),
      });
      return;
    }
    const youTubeChannel = youTubeChannelDocs[0];

    const oldMembershipRoleDoc = await MembershipRoleCollection.findOne({
      $or: [{ _id: role.id }, { youTubeChannel: youTubeChannel._id }],
    }).populate<{
      youTubeChannel: YouTubeChannelDoc;
    }>('youTubeChannel');
    if (oldMembershipRoleDoc) {
      await interaction.editReply({
        content: `The membership role <@&${oldMembershipRoleDoc.id}> is already assigned to the YouTube channel \`${oldMembershipRoleDoc.youTubeChannel.title}\`.`,
      });
      return;
    }

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('add-role-confirm-button')
        .setLabel('Yes, I confirm')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('add-role-cancel-button')
        .setLabel('No, cancel')
        .setStyle(ButtonStyle.Danger),
    );

    const response = await interaction.editReply({
      content: `Are you sure you want to add the membership role <@&${role.id}> for the YouTube channel \`${youTubeChannel.title}\`?`,
      components: [actionRow],
    });

    let buttonInteraction: ButtonInteraction<CacheType> | undefined = undefined;
    try {
      buttonInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (buttonInteraction) =>
          user.id === buttonInteraction.user.id &&
          ['add-role-confirm-button', 'add-role-cancel-button'].includes(
            buttonInteraction.customId,
          ),
        time: 60 * 1000,
      });
    } catch (error) {
      // Timeout
    }
    if (!buttonInteraction) {
      await interaction.editReply({
        content: 'Timed out. Please try again.',
        components: [],
      });
    } else if (buttonInteraction.customId === 'add-role-cancel-button') {
      actionRow.components.forEach((component) => component.setDisabled(true));
      await interaction.editReply({
        components: [actionRow],
      });
      await buttonInteraction.reply({
        content: 'Cancelled.',
        ephemeral: true,
      });
    } else if (buttonInteraction.customId === 'add-role-confirm-button') {
      actionRow.components.forEach((component) => component.setDisabled(true));
      await interaction.editReply({
        components: [actionRow],
      });
      await buttonInteraction.deferReply({ ephemeral: true });
      const newMembershipRoleDoc = await MembershipRoleCollection.build({
        _id: role.id,
        name: role.name,
        color: role.color,
        guild: guild.id,
        youTubeChannel: youTubeChannel._id,
      });
      const populatedNewMembershipRoleDoc = await MembershipRoleCollection.populate<{
        youTubeChannel: YouTubeChannelDoc;
      }>(newMembershipRoleDoc, 'youTubeChannel');

      await buttonInteraction.editReply({
        content: `Successfully added the membership role <@&${populatedNewMembershipRoleDoc._id}> for the YouTube channel \`${populatedNewMembershipRoleDoc.youTubeChannel.title}\`.`,
      });
    }
  },
});

export default add_role;
