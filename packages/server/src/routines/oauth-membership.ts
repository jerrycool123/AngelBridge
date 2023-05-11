import { CronJob } from 'cron';
import { Guild, GuildMember, TextChannel, User } from 'discord.js';
import { google } from 'googleapis';

import client from '../bot/index.js';
import { symmetricDecrypt } from '../libs/crypto.js';
import DiscordUtility from '../libs/discord.js';
import GoogleUtility from '../libs/google.js';
import GuildCollection from '../models/guild.js';
import MembershipRoleCollection from '../models/membership-role.js';
import MembershipCollection, { OAuthMembershipDoc } from '../models/membership.js';
import { UserDoc } from '../models/user.js';
import YouTubeChannelCollection from '../models/youtube-channel.js';

// https://github.com/member-gentei/member-gentei/blob/main/gentei/membership/membership.go'
// https://github.com/konnokai/Discord-Stream-Notify-Bot/blob/master/Discord%20Stream%20Notify%20Bot/SharedService/YoutubeMember/CheckMemberShip.cs

const OAuthMembershipCheckRoutine: CustomCronJob = {
  name: 'OAuthMembershipCheckRoutine',
  cronjob: new CronJob('0 0 * * *', async () => {
    const promises: Promise<unknown>[] = [];

    console.log(
      `[${new Date().toLocaleString('en-US')}] Running OAuth Membership Check routine...`,
    );

    // Find and group memberships from database
    const oauthMembershipDocs = await MembershipCollection.find<OAuthMembershipDoc>({
      type: 'oauth',
    })
      .populate<{ user: UserDoc | null }>('user')
      .sort('membershipRole');
    const membershipDocGroups: (Omit<OAuthMembershipDoc, 'user'> & {
      user: UserDoc;
    })[][] = [];
    const invalidMembershipDocs: (Omit<OAuthMembershipDoc, 'user'> & {
      user: UserDoc | null;
    })[] = [];
    let lastMembershipRoleId: string | null = null;
    for (const membership of oauthMembershipDocs) {
      if (membership.user === null) {
        invalidMembershipDocs.push(membership);
        continue;
      }

      if (membership.membershipRole !== lastMembershipRoleId) {
        membershipDocGroups.push([]);
        lastMembershipRoleId = membership.membershipRole;
      }
      membershipDocGroups[membershipDocGroups.length - 1].push(
        membership as Omit<OAuthMembershipDoc, 'user'> & {
          user: UserDoc;
        },
      );
    }

    // Remove invalid memberships
    if (invalidMembershipDocs.length > 0) {
      await MembershipCollection.deleteMany({
        _id: { $in: invalidMembershipDocs.map(({ _id }) => _id) },
      });
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

      const youTubeChannel = await YouTubeChannelCollection.findById(
        membershipRoleDoc.youTubeChannel,
      );

      // YouTube channel not found in DB
      if (youTubeChannel === null) {
        // Remove user membership record in DB
        console.error(
          `Failed to find the YouTube channel with ID: ${membershipRoleDoc.youTubeChannel} which the role ${membershipRoleDoc.name}(ID: ${membershipRoleDoc._id}) belongs to in the database. The corresponding membership records will be removed.`,
        );

        // Get memberships in all modes from DB
        const allMembershipDocs = await MembershipCollection.find({
          membershipRole: membershipRoleId,
        });

        // Remove the memberships and the membership role in DB
        // ? Note: we do not remove the membership role under the same YouTube channel, otherwise it will be too complicated. They are supposed to be removed in the future runs.
        await Promise.all([
          MembershipCollection.deleteMany({ membershipRole: membershipRoleId }),
          MembershipRoleCollection.findByIdAndDelete(membershipRoleId),
        ]);

        // If the guild is found in Discord API, we try to log the error in the log channel
        if (guild !== null) {
          let logged = false;
          if (logChannel !== null) {
            try {
              await logChannel.send(
                `The membership role **@${membershipRoleDoc.name}** in your owned server ${guild.name} has been removed, since the corresponding YouTube channel with ID: ${membershipRoleDoc.youTubeChannel} has been removed from our database.\n` +
                  'I will try to remove the role from the members, but if I failed to do so, please remove the role manually.\n' +
                  'If you believe this is an error, please contact the bot owner to resolve this issue.',
              );
              logged = true;
            } catch (error) {
              // We cannot log the error in the log channel, so we just ignore it
              console.error(error);
            }
          }

          if (logged === false) {
            // If we cannot send error to the log channel, we try to DM the guild owner about the error
            try {
              const owner = await guild.fetchOwner();
              await owner.send(
                `The membership role **@${membershipRoleDoc.name}** in your owned server ${guild.name} has been removed, since the corresponding YouTube channel with ID: ${membershipRoleDoc.youTubeChannel} has been removed from our database.\n` +
                  'I will try to remove the role from the members, but if I failed to do so, please remove the role manually.\n' +
                  'If you believe this is an error, please contact the bot owner to resolve this issue.',
              );
            } catch (error) {
              // We cannot DM the owner, so we just ignore it
              console.error(error);
            }
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
                  `Your membership role **@${membershipRoleDoc.name}** has been removed, since the corresponding YouTube channel with ID: ${membershipRoleDoc.youTubeChannel} has been removed from our database.`,
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

      // Check membership
      promises.push(
        ...membershipDocGroup.map((membershipDoc) =>
          GoogleUtility.addAsyncAPIJob(async () => {
            const oauth2Client = GoogleUtility.createOAuth2Client();

            let refreshToken: string | null = null;
            if (membershipDoc.user.youTube !== null) {
              refreshToken = symmetricDecrypt(membershipDoc.user.youTube.refreshToken);
            }

            if (refreshToken !== null) {
              oauth2Client.setCredentials({
                refresh_token: refreshToken,
              });
              const youTubeApi = google.youtube({ version: 'v3', auth: oauth2Client });
              try {
                await youTubeApi.commentThreads.list({
                  part: ['id'],
                  videoId:
                    youTubeChannel.memberOnlyVideoIds[
                      Math.floor(Math.random() * youTubeChannel.memberOnlyVideoIds.length)
                    ],
                  maxResults: 1,
                });

                // Successfully verified the YouTube channel membership
                return;
              } catch (error) {
                // ! TODO: distinguish different videos
                // We assume that user does not have the YouTube channel membership if the API call fails
                console.error(error);
              }
            }

            await DiscordUtility.addAsyncAPIJob(async () => {
              // Remove the role from the user
              let user: User | null = null;
              if (guild !== null) {
                let roleRemoved = false;
                try {
                  const member = await guild.members.fetch(membershipDoc.user._id);
                  user = member.user;
                  await member.roles.remove(membershipRoleDoc._id);
                  roleRemoved = true;
                } catch (error) {
                  console.error(error);
                  console.error(
                    `Failed to remove role ${membershipRoleDoc.name}(ID: ${membershipRoleDoc._id}) from user with ID ${membershipDoc.user._id} in guild ${guild.name}(ID: ${guild.id}).`,
                  );
                }

                // If the role is not removed, we try to log the error in the log channel
                if (roleRemoved === false && logChannel !== null) {
                  try {
                    await logChannel.send(
                      `I cannot remove the membership role \`${membershipRoleDoc.name}\` from the user <@${membershipDoc.user._id}> due to one of the following reasons:\n` +
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
                if (user === null) user = await client.users.fetch(membershipDoc.user._id);
                await user.send(
                  `Your membership role **@${membershipRoleDoc.name}** has been removed since we cannot verify your membership from YouTube API.`,
                );
              } catch (error) {
                // We cannot DM the user, so we just ignore it
                console.error(error);
              }

              // Remove membership record in DB
              await MembershipCollection.findByIdAndDelete(membershipDoc._id);
            });
          }),
        ),
      );
    }

    await Promise.all(promises);
    console.log(
      `[${new Date().toLocaleString('en-US')}] OAuth Membership Check routine completed.`,
    );
  }),
};

export default OAuthMembershipCheckRoutine;
