import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

import GuildCollection from '../../models/guild.js';
import MembershipRoleCollection, { MembershipRoleDoc } from '../../models/membership-role.js';
import MembershipCollection, { OCRMembershipDoc } from '../../models/membership.js';
import { MembershipService } from '../../services/membership/index.js';
import { Bot, BotRoutine } from '../../types/bot.js';
import DiscordAPI from '../../utils/discord.js';
import { BotCheckers } from '../utils/index.js';

dayjs.extend(utc);

export class CheckOCRMembershipRoutine implements BotRoutine {
  public readonly name = 'Check OCR Membership';
  public readonly schedule = '0 12 * * *';

  public async execute(bot: Bot): Promise<void> {
    console.log(`[${dayjs().format()}] Running OCR Membership Check routine...`);

    // Get expired OCR memberships from DB
    const currentDate = dayjs.utc().startOf('day');
    const ocrMembershipDocs = await MembershipCollection.find<OCRMembershipDoc>({
      type: 'ocr',
      billingDate: { $lte: currentDate.toISOString() },
    });

    // Group memberships by membership role
    const membershipDocRecord =
      MembershipService.groupMembershipDocsByMembershipRole(ocrMembershipDocs);

    // Check memberships by group
    const promises: Promise<unknown>[] = [];
    for (const [membershipRoleId, membershipDocGroup] of Object.entries(membershipDocRecord)) {
      if (membershipDocGroup.length === 0) continue;

      console.log(`Checking membership role with ID: ${membershipRoleId}...`);

      // Create membership service without event log
      const membershipService = new MembershipService(bot);

      // Get membership role from DB
      const membershipRoleDoc = await MembershipRoleCollection.findById(membershipRoleId);
      if (membershipRoleDoc === null) {
        console.error(
          `Failed to find membership role with ID: ${membershipRoleId} in the database. ` +
            'The corresponding membership records will be removed.',
        );
        promises.push(
          membershipService.removeMembershipRole({
            membershipDocGroup,
            membershipRoleId,
            removeReason: 'it is removed from our database',
          }),
        );
        continue;
      }

      // Get guild from DB
      const guildId = membershipRoleDoc.guild;
      const guildDoc = await GuildCollection.findById(guildId);

      // Initialize event log of membership service
      await membershipService.initEventLog(guildId, guildDoc?.logChannel ?? null);

      // Remove membership records if guild does not exist
      if (guildDoc === null) {
        console.error(
          `Failed to find the server with ID: ${guildId} which the role with ID: ${membershipRoleId} belongs to in the database. ` +
            'The corresponding membership records will be removed.',
        );

        const guildString =
          membershipService.guild !== null
            ? `\`${membershipService.guild.name}\``
            : `with ID: ${guildId}`;
        promises.push(
          membershipService.removeMembershipRole({
            membershipDocGroup,
            membershipRoleId,
            removeReason: `its parent server ${guildString} has been removed from our database`,
          }),
        );
        continue;
      }

      // Check membership
      promises.push(
        ...membershipDocGroup.map((membershipDoc) =>
          this.checkOCRMembership({
            bot,
            guildName: membershipService.guild?.name ?? guildDoc.name,
            membershipDoc,
            membershipRoleDoc,
            currentDate,
            membershipService,
          }),
        ),
      );
    }
    await Promise.all(promises);
    console.log(`[${dayjs().format()}] OCR Membership Check routine completed.`);
  }

  public async checkOCRMembership({
    bot,
    guildName,
    membershipDoc,
    membershipRoleDoc,
    currentDate,
    membershipService,
  }: {
    bot: Bot;
    guildName: string;
    membershipDoc: OCRMembershipDoc;
    membershipRoleDoc: MembershipRoleDoc;
    currentDate: dayjs.Dayjs;
    membershipService: MembershipService;
  }) {
    const billingDate = dayjs.utc(membershipDoc.billingDate).startOf('day');
    const userId = membershipDoc.user;
    const membershipRoleName = membershipRoleDoc.name;

    await DiscordAPI.queue.add(async () => {
      if (billingDate.isSame(currentDate, 'date')) {
        // When the billing date is today, we remind the user to renew their membership

        // Remind user to renew membership
        try {
          const user = await BotCheckers.fetchUser(bot, userId, false);
          if (user !== null) {
            await user.send(
              `Your membership role **@${membershipRoleName}** will expire tomorrow.\n` +
                `Please use \`/verify\` command to renew your membership in the server \`${guildName}\`.`,
            );
          }
        } catch (error) {
          // We cannot DM the user, so we just ignore it
          console.error(error);
        }
      } else if (billingDate.isBefore(currentDate, 'date')) {
        // When the billing date is before today, we remove the user's membership

        await membershipService.removeMembership({
          membershipDoc,
          membershipRoleData: membershipRoleDoc,
          removeReason:
            'has expired.\n' +
            `Please use \`/verify\` command to renew your membership in the server \`${guildName}\``,
        });
      } else {
        // This should not happen
        console.error(
          `Membership for user with ID: ${userId} has due date: ${billingDate.format(
            'YYYY-MM-DD',
          )} which is before current date: ${currentDate.format('YYYY-MM-DD')}`,
        );
      }
    });
  }
}
