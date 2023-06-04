import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import { RepliableInteraction, SlashCommandBuilder } from 'discord.js';

import CommonChecker from '../../../checkers/common.js';
import DBChecker from '../../../checkers/db.js';
import MembershipCollection from '../../../models/membership.js';
import {
  Bot,
  BotCommandTrigger,
  BotErrorConfig,
  GuildChatInputCommandInteraction,
} from '../../../types/bot.js';
import { DBUtils } from '../../../utils/db.js';
import { BadRequestError, InternalServerError, NotFoundError } from '../../../utils/error.js';
import { BotEmbeds } from '../../components/embeds.js';
import { BotConfig } from '../../config.js';
import { BotCheckers, BotCommonUtils } from '../../utils/index.js';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

export class AddMemberCommandTrigger implements BotCommandTrigger<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('add-member')
    .setDescription(
      'Manually assign a YouTube membership role to a member in this server in OCR mode',
    )
    .setDefaultMemberPermissions(BotConfig.ModeratorPermissions)
    .addGenericUserOption('member', 'The member to assign the role to', true)
    .addGenericRoleOption('role', 'The YouTube Membership role in this server', true)
    .addGenericStringOption(
      'billing_date',
      'The next billing date of the member in YYYY/MM/DD, default to tomorrow',
    );
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = true;

  public async execute(
    bot: Bot,
    interaction: GuildChatInputCommandInteraction,
    errorConfig: BotErrorConfig,
  ): Promise<void> {
    const { guild, user: moderator, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Guild and log channel checks
    const { logChannel: logChannelId } = await DBChecker.requireGuildWithLogChannel(guild.id);
    const logChannel = await BotCheckers.requireGuildHasLogChannel(bot, guild, logChannelId);

    // Get membership role and check if it's manageable
    const role = options.getRole('role', true);
    await DBChecker.requireMembershipRoleWithYouTubeChannel(guild.id, role.id);
    await BotCheckers.requireManageableRole(guild, role.id);

    // Get the next billing date
    let expireAt: dayjs.Dayjs;
    const billing_date = options.getString('billing_date');
    if (billing_date !== null) {
      expireAt = dayjs.utc(billing_date, 'YYYY/MM/DD', true);
      if (!expireAt.isValid()) {
        throw new BadRequestError(
          `The billing date \`${billing_date}\` is not a valid date in YYYY/MM/DD format.`,
        );
      }
      expireAt = expireAt.startOf('date');
    } else {
      expireAt = dayjs.utc().add(1, 'day').startOf('date');
    }

    // Check if the recognized date is too far in the future
    CommonChecker.requireGivenDateNotTooFarInFuture(expireAt);

    // Upsert user
    const user = options.getUser('member', true);
    await DBUtils.upsertUser(BotCommonUtils.getUserMeta(user));

    // Get guild member
    const member = await BotCheckers.fetchGuildMember(guild, user.id, false);
    if (member === null) {
      throw new NotFoundError(`The user <@${user.id}> is not a member of this server.`);
    }

    // Check if the user already has OAuth membership
    const oauthMembershipDoc = await MembershipCollection.findOne({
      type: 'oauth',
      user: user.id,
      membershipRole: role.id,
    });
    let activeInteraction: RepliableInteraction = interaction;
    if (oauthMembershipDoc !== null) {
      activeInteraction = await BotCommonUtils.awaitUserConfirm(
        activeInteraction,
        'add-member-detected-oauth',
        {
          content: `The user <@${user.id}> already has an OAuth membership. Do you want to overwrite it?`,
        },
        errorConfig,
      );
      await activeInteraction.deferReply({ ephemeral: true });
      errorConfig.activeInteraction = activeInteraction;
    }

    // Ask for confirmation
    const confirmButtonInteraction = await BotCommonUtils.awaitUserConfirm(
      activeInteraction,
      'add-member',
      {
        content: `Are you sure you want to assign the membership role <@&${role.id}> to <@${
          member.id
        }>?\nTheir membership will expire on \`${expireAt.format('YYYY/MM/DD')}\`.`,
      },
      errorConfig,
    );
    await confirmButtonInteraction.deferReply({ ephemeral: true });

    // Add role to member
    try {
      await member.roles.add(role.id);
    } catch (error) {
      console.error(error);
      throw new InternalServerError('Failed to add the role to the member.');
    }
    await confirmButtonInteraction.genericReply({
      content: `Successfully assigned the membership role <@&${role.id}> to <@${
        member.id
      }>.\nTheir membership will expire on \`${expireAt.format('YYYY/MM/DD')}\`.`,
    });

    // Create or update membership
    await DBUtils.upsertMembership({
      type: 'ocr',
      userId: member.id,
      membershipRoleId: role.id,
      expireAt,
    });

    // DM the user
    let notified = false;
    try {
      await member.send({
        content: `You have been manually granted the membership role **@${role.name}** in the server \`${guild.name}\`.`,
      });
      notified = true;
    } catch (error) {
      // User does not allow DMs
    }

    // Send log message
    const manualMembershipAssignment = BotEmbeds.createManualMembershipAssignmentEmbed(
      user,
      expireAt,
      role.id,
      moderator.id,
    );
    await logChannel.send({
      content: notified
        ? ''
        : "**[NOTE]** Due to the user's __Privacy Settings__ of this server, **I cannot send DM to notify them.**\nYou might need to notify them yourself.",
      embeds: [manualMembershipAssignment],
    });
  }
}
