import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import { RepliableInteraction, SlashCommandBuilder } from 'discord.js';

import CommonChecker from '../../../checkers/common.js';
import DBChecker from '../../../checkers/db.js';
import MembershipCollection from '../../../models/membership.js';
import { MembershipService } from '../../../services/membership/service.js';
import {
  Bot,
  BotCommandTrigger,
  BotErrorConfig,
  GuildChatInputCommandInteraction,
} from '../../../types/bot.js';
import { DBUtils } from '../../../utils/db.js';
import { BadRequestError, NotFoundError } from '../../../utils/error.js';
import { BotEmbeds } from '../../components/embeds.js';
import { BotConstants } from '../../constants.js';
import { BotCheckers, BotCommonUtils } from '../../utils/index.js';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

export class AddMemberCommandTrigger implements BotCommandTrigger<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('add-member')
    .setDescription(
      'Manually assign a YouTube membership role to a member in this server in OCR mode',
    )
    .setDefaultMemberPermissions(BotConstants.ModeratorPermissions)
    .addGenericUserOption('member', 'The member to assign the role to', true)
    .addGenericRoleOption('role', 'The YouTube Membership role in this server', true)
    .addGenericStringOption(
      'billing_date',
      'The next billing date of the member in YYYY/MM/DD, default to tomorrow',
    );
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = true;

  public async execute(
    bot: Bot<true>,
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
      errorConfig.activeInteraction = activeInteraction;
      await activeInteraction.deferReply({ ephemeral: true });
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
    errorConfig.activeInteraction = confirmButtonInteraction;
    await confirmButtonInteraction.deferReply({ ephemeral: true });

    // Initialize membership service
    const membershipService = new MembershipService(bot);
    await membershipService.initEventLog(guild, null, logChannel);

    // Add membership to user
    const { notified } = await membershipService.addMembership({
      member,
      membership: {
        type: 'ocr',
        expireAt,
      },
      guild,
      membershipRole: role,
    });

    // Send added log
    const manualMembershipAssignmentEmbed = BotEmbeds.createManualMembershipAssignmentEmbed(
      member.user,
      expireAt,
      role.id,
      moderator.id,
    );
    await membershipService.sendEventLog(
      notified
        ? ''
        : "**[NOTE]** Due to the user's __Privacy Settings__ of this server, **I cannot send DM to notify them.**\nYou might need to notify them yourself.",
      [manualMembershipAssignmentEmbed],
    );

    await confirmButtonInteraction.genericReply({
      content: `Successfully assigned the membership role <@&${role.id}> to <@${
        member.id
      }>.\nTheir membership will expire on \`${expireAt.format('YYYY/MM/DD')}\`.`,
    });
  }
}
