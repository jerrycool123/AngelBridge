import { CronJob } from 'cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { Guild, User } from 'discord.js';

import client from '../bot/index.js';
import sleep from '../libs/sleep.js';
import GuildCollection from '../models/guild.js';
import MembershipRoleCollection from '../models/membership-role.js';
import MembershipCollection, { OCRMembershipDoc } from '../models/membership.js';

dayjs.extend(utc);

const OCRMembershipCheckRoutine: CustomCronJob = {
  name: 'OCR Membership Check',
  cronjob: new CronJob('0 12 * * *', async () => {
    console.log(`[${new Date().toLocaleString('en-US')}] Running OCR Membership Check routine...`);
    const currentDate = dayjs.utc().startOf('day');
    const ocrMembershipDocs = await MembershipCollection.find<OCRMembershipDoc>({
      type: 'ocr',
      billingDate: { $lte: currentDate.toISOString() },
    }).sort('membershipRole');

    const membershipDocGroups: OCRMembershipDoc[][] = [];
    let lastMembershipRoleId: string | null = null;
    for (const membership of ocrMembershipDocs) {
      if (membership.membershipRole !== lastMembershipRoleId) {
        membershipDocGroups.push([]);
        lastMembershipRoleId = membership.membershipRole;
      }
      membershipDocGroups[membershipDocGroups.length - 1].push(membership);
    }

    for (const membershipDocGroup of membershipDocGroups) {
      if (membershipDocGroup.length === 0) continue;
      const firstMembership = membershipDocGroup[0];

      console.log(`Checking membership role with ID: ${firstMembership.membershipRole}...`);

      const membershipRoleId = firstMembership.membershipRole;
      const membershipRoleDoc = await MembershipRoleCollection.findById(membershipRoleId);
      if (!membershipRoleDoc) {
        // Remove user membership record in DB
        console.error(
          `Failed to find membership role with ID: ${membershipRoleId} in the database. The corresponding membership records will be removed.`,
        );
        await MembershipCollection.deleteMany({ membershipRole: membershipRoleId });

        // DM user about the removal
        for (const membershipDoc of membershipDocGroup) {
          try {
            const user = await client.users.fetch(membershipDoc.user);
            await user.send(
              `Your membership role with ID: ${membershipRoleId} has been removed, since it has been removed from our database.`,
            );
          } catch (error) {
            // We cannot DM the user, so we just ignore it
            console.error(error);
          }
          await sleep(100);
        }
        continue;
      }

      const guildDoc = await GuildCollection.findById(membershipRoleDoc.guild);
      if (!guildDoc) {
        // Remove user membership record in DB
        console.error(
          `Failed to find the server with ID: ${membershipRoleDoc.guild} which the role ${membershipRoleDoc.name}(ID: ${membershipRoleDoc._id}) belongs to in the database. The corresponding membership records will be removed.`,
        );
        await MembershipCollection.deleteMany({ membershipRole: membershipRoleId });

        // Remove membership role in DB
        await MembershipRoleCollection.findByIdAndDelete(membershipRoleId);

        // DM user about the removal
        for (const membershipDoc of membershipDocGroup) {
          try {
            const user = await client.users.fetch(membershipDoc.user);
            await user.send(
              `Your membership role **@${membershipRoleDoc.name}** has been removed, since the server with ID: ${membershipRoleDoc.guild} has been removed from our database.`,
            );
          } catch (error) {
            // We cannot DM the user, so we just ignore it
            console.error(error);
          }
          await sleep(100);
        }
        continue;
      }

      let guild: Guild | null = null;
      try {
        guild = await client.guilds.fetch({ guild: guildDoc._id, force: true });
      } catch (error) {
        console.error(error);
        console.error(
          `Failed to fetch guild ${guildDoc.name}(ID: ${guildDoc._id}) from Discord API.`,
        );
      }
      if (guild) {
        // Update guild cache in DB
        guildDoc.name = guild.name;
        guildDoc.icon = guild.iconURL();
        await guildDoc.save();
      }

      // TODO: check membership
      for (const membershipDoc of membershipDocGroup) {
        const billingDate = dayjs.utc(firstMembership.billingDate).startOf('day');
        if (billingDate.isSame(currentDate, 'date')) {
          // Remind user to renew membership
          try {
            const user = await client.users.fetch(membershipDoc.user);
            await user.send(
              `Your membership role **@${membershipRoleDoc.name}** will expire tomorrow.\n` +
                `Please use \`/verify\` command to renew your membership in the server \`${guildDoc.name}\`.`,
            );
          } catch (error) {
            // We cannot DM the user, so we just ignore it
            console.error(error);
          }
        } else if (billingDate.isBefore(currentDate, 'date')) {
          // Remove user membership
          let roleRemoved = false;
          let user: User | null = null;

          // Remove the role from the user
          if (guild) {
            try {
              const member = await guild.members.fetch(membershipDoc.user);
              user = member.user;
              await member.roles.remove(membershipRoleDoc._id);
              roleRemoved = true;
            } catch (error) {
              console.error(error);
              console.error(
                `Failed to remove role ${membershipRoleDoc.name}(ID: ${membershipRoleDoc._id}) from user with ID ${membershipDoc.user} in guild ${guild.name}(ID: ${guild.id}).`,
              );
            }
          }

          try {
            if (!user) user = await client.users.fetch(membershipDoc.user);
            await user.send(
              `Your membership role **@${membershipRoleDoc.name}** has expired.\n` +
                `Please use \`/verify\` command to renew your membership in the server \`${guildDoc.name}\`.` +
                (roleRemoved
                  ? ''
                  : 'However, we cannot remove the membership role from you due to one of the following reasons:\n' +
                    '- You have left the server\n' +
                    '- The membership role has been removed from the server\n' +
                    '- The bot does not have the permission to manage roles\n' +
                    '- The bot is no longer in the server\n' +
                    '\nIf you believe this is an error, please contact the server owner or the bot owner to resolve this issue.'),
            );
          } catch (error) {
            // We cannot DM the user, so we just ignore it
            console.error(error);
          }
          await MembershipCollection.findByIdAndDelete(membershipDoc._id);
        } else {
          // This should not happen
          console.error(
            `Membership for user with ID: ${membershipDoc.user} has due date: ${billingDate.format(
              'YYYY-MM-DD',
            )} which is before current date: ${currentDate.format('YYYY-MM-DD')}`,
          );
        }
        await sleep(100);
      }
    }
    console.log(`[${new Date().toLocaleString('en-US')}] OCR Membership Check routine completed.`);
  }),
};

export default OCRMembershipCheckRoutine;
