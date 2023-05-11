import { CronJob } from 'cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { Guild, GuildMember, TextChannel, User } from 'discord.js';

import client from '../bot/index.js';
import DiscordUtility from '../libs/discord.js';
import GuildCollection from '../models/guild.js';
import MembershipRoleCollection from '../models/membership-role.js';
import MembershipCollection, { OCRMembershipDoc } from '../models/membership.js';

dayjs.extend(utc);

const OCRMembershipCheckRoutine: CustomCronJob = {
  name: 'OCR Membership Check',
  cronjob: new CronJob('0 12 * * *', async () => {
    console.log(`[${dayjs().format()}] Running OCR Membership Check routine...`);
    const promises: Promise<unknown>[] = [];
    const currentDate = dayjs.utc().startOf('day');

    // Find and group memberships from database
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

    // Check membership by group
    for (const membershipDocGroup of membershipDocGroups) {
      if (membershipDocGroup.length === 0) continue;
      const firstMembership = membershipDocGroup[0];

      console.log(`Checking membership role with ID: ${firstMembership.membershipRole}...`);

      const membershipRoleId = firstMembership.membershipRole;
      const membershipRoleDoc = await MembershipRoleCollection.findById(membershipRoleId);

      // Membership role not found in DB
      if (membershipRoleDoc === null) {
        // Remove user membership record in DB
        console.error(
          `Failed to find membership role with ID: ${membershipRoleId} in the database. The corresponding membership records will be removed.`,
        );

        // Get memberships in all modes from DB
        const allMembershipDocs = await MembershipCollection.find({
          membershipRole: membershipRoleId,
        });

        // Remove the memberships in DB
        await MembershipCollection.deleteMany({ membershipRole: membershipRoleId });

        // DM user about the removal
        promises.push(
          ...allMembershipDocs.map((membershipDoc) =>
            DiscordUtility.addAsyncAPIJob(async () => {
              try {
                const user = await client.users.fetch(membershipDoc.user);
                await user.send(
                  `Your membership role with ID: ${membershipRoleId} has been removed, since it has been removed from our database.`,
                );
              } catch (error) {
                // We cannot DM the user, so we just ignore it
                console.error(error);
              }
            }),
          ),
        );
        continue;
      }

      // Fetch guild from Discord bot
      let guild: Guild | null = null;
      try {
        guild = await client.guilds.fetch({ guild: membershipRoleDoc.guild, force: true });
      } catch (error) {
        console.error(error);
        console.error(
          `Failed to fetch guild with ID: ${membershipRoleDoc.guild} from Discord API.`,
        );
      }

      const guildDoc = await GuildCollection.findById(membershipRoleDoc.guild);

      // Guild not found in DB
      if (guildDoc === null) {
        // Remove user membership record in DB
        console.error(
          `Failed to find the server with ID: ${membershipRoleDoc.guild} which the role ${membershipRoleDoc.name}(ID: ${membershipRoleDoc._id}) belongs to in the database. The corresponding membership records will be removed.`,
        );

        // Get memberships in all modes from DB
        const allMembershipDocs = await MembershipCollection.find({
          membershipRole: membershipRoleId,
        });

        // Remove the memberships and the membership role in DB
        await Promise.all([
          MembershipCollection.deleteMany({ membershipRole: membershipRoleId }),
          MembershipRoleCollection.findByIdAndDelete(membershipRoleId),
        ]);

        // If the guild is found in Discord API, we try to DM the guild owner about the removal
        if (guild !== null) {
          try {
            const owner = await guild.fetchOwner();
            await owner.send(
              `The membership role **@${membershipRoleDoc.name}** in your owned server ${guild.name} has been removed, since the server has been removed from our database.\n` +
                'I will try to remove the role from the members, but if I failed to do so, please remove the role manually.\n' +
                'If you believe this is an error, please contact the bot owner to resolve this issue.',
            );
          } catch (error) {
            // We cannot DM the owner, so we just ignore it
            console.error(error);
          }
        }

        promises.push(
          ...allMembershipDocs.map((membershipDoc) =>
            DiscordUtility.addAsyncAPIJob(async () => {
              // If the guild is found in Discord API, we try to remove the role from the members
              let user: GuildMember | User | null = null;
              if (guild !== null) {
                try {
                  user = await guild.members.fetch(membershipDoc.user);
                  await user.roles.remove(membershipRoleDoc._id);
                } catch (error) {
                  // We cannot remove the role from the user, so we just ignore it
                  console.error(error);
                }
              }

              // DM user about the removal
              try {
                if (user === null) {
                  user = await client.users.fetch(membershipDoc.user);
                }
                await user.send(
                  `Your membership role **@${membershipRoleDoc.name}** has been removed, since the server with ID: ${membershipRoleDoc.guild} has been removed from our database.`,
                );
              } catch (error) {
                // We cannot DM the user, so we just ignore it
                console.error(error);
              }
            }),
          ),
        );
        continue;
      }

      // If the guild is found in both Discord API and DB, we try to fetch the log channel to send error message
      let logChannel: TextChannel | null = null;
      if (guild !== null) {
        if (guildDoc.logChannel !== null) {
          try {
            const channel = await guild.channels.fetch(guildDoc.logChannel);
            if (channel instanceof TextChannel) {
              logChannel = channel;
            }
          } catch (error) {
            console.error(error);
            console.error(
              `Failed to fetch log channel with ID: ${guildDoc.logChannel} from Discord API.`,
            );
          }
        }

        // If the log channel is not found, we try to DM the guild owner about the error
        if (logChannel === null) {
          try {
            const owner = await guild.fetchOwner();
            await owner.send(
              `I cannot work properly in your owned server ${guild.name}, since the server does not have a log channel registered in our database.\n` +
                'Thus, we cannot send either OCR verification requests or error messages to your server.\n' +
                'Please use `/set-log-channel` command to set the log channel for your server.',
            );
          } catch (error) {
            // We cannot DM the owner, so we just ignore it
            console.error(error);
          }
        }
      }

      // Check membership
      promises.push(
        ...membershipDocGroup.map((membershipDoc) =>
          DiscordUtility.addAsyncAPIJob(async () => {
            const billingDate = dayjs.utc(firstMembership.billingDate).startOf('day');

            if (billingDate.isSame(currentDate, 'date')) {
              // When the billing date is today, we remind the user to renew their membership

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
              // When the billing date is before today, we remove the user's membership

              // Remove the role from the user
              let user: User | null = null;
              if (guild !== null) {
                let roleRemoved = false;
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

                // If the role is not removed, we try to log the error in the log channel
                if (roleRemoved === false && logChannel !== null) {
                  try {
                    await logChannel.send(
                      `I cannot remove the membership role \`${membershipRoleDoc.name}\` from the user <@${membershipDoc.user}> due to one of the following reasons:\n` +
                        '- The user has left the server\n' +
                        '- The membership role has been removed from the server\n' +
                        '- The bot does not have the permission to manage roles\n' +
                        '- The bot is no longer in the server\n' +
                        '- Other unknown bot error\n' +
                        '\nIf you believe this is an unexpected error, please check if every settings is fine, or contact the bot owner to resolve this issue.',
                    );
                  } catch (error) {
                    // We cannot send the error message to the log channel, so we just ignore it
                    console.error(error);
                  }
                }
              }

              // Notify user about the removal
              try {
                if (user === null) user = await client.users.fetch(membershipDoc.user);
                await user.send(
                  `Your membership role **@${membershipRoleDoc.name}** has expired.\n` +
                    `Please use \`/verify\` command to renew your membership in the server \`${guildDoc.name}\`.`,
                );
              } catch (error) {
                // We cannot DM the user, so we just ignore it
                console.error(error);
              }

              // Remove membership record in DB
              await MembershipCollection.findByIdAndDelete(membershipDoc._id);
            } else {
              // This should not happen
              console.error(
                `Membership for user with ID: ${
                  membershipDoc.user
                } has due date: ${billingDate.format(
                  'YYYY-MM-DD',
                )} which is before current date: ${currentDate.format('YYYY-MM-DD')}`,
              );
            }
          }),
        ),
      );
    }
    await Promise.all(promises);
    console.log(`[${dayjs().format()}] OCR Membership Check routine completed.`);
  }),
};

export default OCRMembershipCheckRoutine;
