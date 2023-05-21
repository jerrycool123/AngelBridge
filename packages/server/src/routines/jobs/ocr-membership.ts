import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { GuildMember, TextChannel } from 'discord.js';

import BotChecker from '../../checkers/bot.js';
import DiscordAPI from '../../libs/discord.js';
import GuildCollection from '../../models/guild.js';
import MembershipRoleCollection, { MembershipRoleDoc } from '../../models/membership-role.js';
import MembershipCollection, { OCRMembershipDoc } from '../../models/membership.js';
import {
  GuildInfo,
  cleanUpMissingMembershipRole,
  fetchGuild,
  fetchGuildOwner,
  fetchLogChannel,
  groupMembershipDocsByMembershipRole,
  removeUserMembership,
} from '../utils.js';

dayjs.extend(utc);

const checkOCRMembershipJob = async () => {
  console.log(`[${dayjs().format()}] Running OCR Membership Check routine...`);

  // Get expired OCR memberships from DB
  const currentDate = dayjs.utc().startOf('day');
  const ocrMembershipDocs = await MembershipCollection.find<OCRMembershipDoc>({
    type: 'ocr',
    billingDate: { $lte: currentDate.toISOString() },
  });

  // Group memberships by membership role
  const membershipDocRecord = groupMembershipDocsByMembershipRole(ocrMembershipDocs);

  // Check memberships by group
  const promises: Promise<unknown>[] = [];
  for (const membershipDocGroup of Object.values(membershipDocRecord)) {
    if (membershipDocGroup.length === 0) continue;
    const firstMembershipDoc = membershipDocGroup[0];
    const membershipRoleId = firstMembershipDoc.membershipRole;

    console.log(`Checking membership role with ID: ${membershipRoleId}...`);

    // Get membership role from DB
    const membershipRoleDoc = await MembershipRoleCollection.findById(membershipRoleId);
    if (membershipRoleDoc === null) {
      console.error(
        `Failed to find membership role with ID: ${membershipRoleId} in the database. ` +
          'The corresponding membership records will be removed.',
      );
      promises.push(
        ...(await cleanUpMissingMembershipRole(
          membershipRoleId,
          membershipDocGroup,
          'it is removed from our database',
        )),
      );
      continue;
    }

    // Fetch guild from Discord bot
    const guildId = membershipRoleDoc.guild;
    const guild = await fetchGuild(guildId);
    const guildString = guild !== null ? `\`${guild.name}\`` : `with ID: ${guildId}`;

    // Fetch guild owner from Discord bot
    const guildOwner = await fetchGuildOwner(guild);

    // Get guild from DB
    const guildDoc = await GuildCollection.findById(guildId);
    if (guildDoc === null) {
      console.error(
        `Failed to find the server with ID: ${guildId} which the role with ID: ${membershipRoleId} belongs to in the database. ` +
          'The corresponding membership records will be removed.',
      );
      promises.push(
        ...(await cleanUpMissingMembershipRole(
          membershipRoleId,
          membershipDocGroup,
          `its parent server ${guildString} has been removed from our database`,
          guildOwner,
        )),
      );
      continue;
    }

    // Fetch log channel
    const logChannel = await fetchLogChannel(guild, guildDoc, guildOwner);

    // Check membership
    let guildInfo: GuildInfo;
    if (guild !== null) {
      guildInfo = { type: 'guild', data: guild };
    } else {
      guildInfo = { type: 'partialGuild', data: { id: guildId, name: guildDoc.name } };
    }
    promises.push(
      ...membershipDocGroup.map((membershipDoc) =>
        checkOCRMembership({
          membershipRoleDoc,
          membershipDoc,
          currentDate,
          guildInfo,
          guildOwner,
          logChannel,
        }),
      ),
    );
  }
  await Promise.all(promises);
  console.log(`[${dayjs().format()}] OCR Membership Check routine completed.`);
};

export const checkOCRMembership = async ({
  membershipDoc,
  membershipRoleDoc,
  currentDate,
  guildInfo,
  guildOwner,
  logChannel,
}: {
  membershipDoc: OCRMembershipDoc;
  membershipRoleDoc: MembershipRoleDoc;
  currentDate: dayjs.Dayjs;
  guildInfo: GuildInfo;
  guildOwner: GuildMember | null;
  logChannel: TextChannel | null;
}) => {
  const billingDate = dayjs.utc(membershipDoc.billingDate).startOf('day');
  const userId = membershipDoc.user;
  const membershipRoleName = membershipRoleDoc.name;
  const guildName = guildInfo.data.name;

  await DiscordAPI.addJob(async () => {
    if (billingDate.isSame(currentDate, 'date')) {
      // When the billing date is today, we remind the user to renew their membership

      // Remind user to renew membership
      try {
        const user = await BotChecker.requireUser(userId);
        await user.send(
          `Your membership role **@${membershipRoleName}** will expire tomorrow.\n` +
            `Please use \`/verify\` command to renew your membership in the server \`${guildName}\`.`,
        );
      } catch (error) {
        // We cannot DM the user, so we just ignore it
        console.error(error);
      }
    } else if (billingDate.isBefore(currentDate, 'date')) {
      // When the billing date is before today, we remove the user's membership

      await removeUserMembership({
        membershipDoc,
        membershipRoleDoc,
        guildInfo,
        guildOwner,
        logChannel,
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
};

export default checkOCRMembershipJob;
