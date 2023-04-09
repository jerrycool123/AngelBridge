import { CronJob } from 'cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { Guild, User } from 'discord.js';

import client from '../bot/index.js';
import sleep from '../libs/sleep.js';
import GuildCollection from '../models/guild.js';
import MembershipRole from '../models/membership-role.js';
import Membership, { OCRMembershipDoc } from '../models/membership.js';

dayjs.extend(utc);

const OCRMembershipCheckRoutine: CustomCronJob = {
  name: 'OCR Membership Check',
  cronjob: new CronJob('0 12 * * *', async () => {
    console.log(`[${new Date().toLocaleString('en-US')}] Running OCR Membership Check routine...`);
    const currentDate = dayjs.utc().startOf('day');
    const ocrMemberships = await Membership.find<OCRMembershipDoc>({
      type: 'ocr',
      billingDate: { $lte: currentDate.toISOString() },
    }).sort('membershipRole');

    const membershipGroups: OCRMembershipDoc[][] = [];
    let lastMembershipRoleId: string | null = null;
    for (const membership of ocrMemberships) {
      if (membership.membershipRole !== lastMembershipRoleId) {
        membershipGroups.push([]);
        lastMembershipRoleId = membership.membershipRole;
      }
      membershipGroups[membershipGroups.length - 1].push(membership);
    }

    for (const membershipGroup of membershipGroups) {
      if (membershipGroup.length === 0) continue;
      const firstMembership = membershipGroup[0];

      console.log(`Checking membership role with ID: ${firstMembership.membershipRole}...`);

      const membershipRoleId = firstMembership.membershipRole;
      const membershipRole = await MembershipRole.findById(membershipRoleId);
      if (!membershipRole) {
        // Remove user membership record in DB
        console.error(
          `Failed to find membership role with ID: ${membershipRoleId} in the database. The corresponding membership records will be removed.`,
        );
        await Membership.deleteMany({ membershipRole: membershipRoleId });

        // DM user about the removal
        for (const membership of membershipGroup) {
          try {
            const user = await client.users.fetch(membership.user);
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

      const dbGuild = await GuildCollection.findById(membershipRole.guild);
      if (!dbGuild) {
        // Remove user membership record in DB
        console.error(
          `Failed to find the guild with ID: ${membershipRole.guild} which the role ${membershipRole.name}(ID: ${membershipRole._id}) belongs to in the database. The corresponding membership records will be removed.`,
        );
        await Membership.deleteMany({ membershipRole: membershipRoleId });

        // Remove membership role in DB
        await MembershipRole.findByIdAndDelete(membershipRoleId);

        // DM user about the removal
        for (const membership of membershipGroup) {
          try {
            const user = await client.users.fetch(membership.user);
            await user.send(
              `Your membership role **@${membershipRole.name}** has been removed, since the server with ID: ${membershipRole.guild} has been removed from our database.`,
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
        guild = await client.guilds.fetch({ guild: dbGuild._id, force: true });
      } catch (error) {
        console.error(error);
        console.error(
          `Failed to fetch guild ${dbGuild.name}(ID: ${dbGuild._id}) from Discord API.`,
        );
      }
      if (guild) {
        // Update guild cache in DB
        dbGuild.name = guild.name;
        dbGuild.icon = guild.iconURL();
        await dbGuild.save();
      }

      // TODO: check membership
      for (const membership of membershipGroup) {
        const billingDate = dayjs.utc(firstMembership.billingDate).startOf('day');
        if (billingDate.isSame(currentDate, 'date')) {
          // Remind user to renew membership
          try {
            const user = await client.users.fetch(membership.user);
            await user.send(
              `Your membership role **@${membershipRole.name}** will expire tomorrow.\n` +
                `Please use \`/verify\` command to renew your membership in the server \`${dbGuild.name}\`.`,
            );
          } catch (error) {
            // We cannot DM the user, so we just ignore it
            console.error(error);
          }
        } else if (billingDate.isBefore(currentDate, 'date')) {
          // Remove user membership
          let roleRemoved = false;
          let user: User | null = null;

          await Membership.findOneAndDelete({ membershipRole: membershipRoleId });

          // Remove the role from the user
          if (guild) {
            try {
              const member = await guild.members.fetch(membership.user);
              await member.roles.remove(membershipRole._id);
              user = member.user;
              roleRemoved = true;
            } catch (error) {
              console.error(error);
              console.error(
                `Failed to remove role ${membershipRole.name}(ID: ${membershipRole._id}) from user with ID ${membership.user} in guild ${guild.name}(ID: ${guild.id}).`,
              );
            }
          }

          try {
            if (!user) user = await client.users.fetch(membership.user);
            await user.send(
              `Your membership role **@${membershipRole.name}** has expired.\n` +
                `Please use \`/verify\` command to renew your membership in the server \`${dbGuild.name}\`.` +
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
          await Membership.findByIdAndDelete(membership._id);
        } else {
          // This should not happen
          console.error(
            `Membership for user with ID: ${membership.user} has due date: ${billingDate.format(
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
