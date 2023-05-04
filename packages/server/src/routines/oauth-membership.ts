import { CronJob } from 'cron';
import { Guild, User } from 'discord.js';
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
        await MembershipCollection.deleteMany({ membershipRole: membershipRoleId });

        // DM user about the removal
        promises.push(
          ...membershipDocGroup.map((membershipDoc) =>
            DiscordUtility.addJobToQueue(async () => {
              try {
                const user = await client.users.fetch(membershipDoc.user._id);
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

      const guildDoc = await GuildCollection.findById(membershipRoleDoc.guild);

      // Guild not found in DB
      if (guildDoc === null) {
        // Remove user membership record in DB
        console.error(
          `Failed to find the server with ID: ${membershipRoleDoc.guild} which the role ${membershipRoleDoc.name}(ID: ${membershipRoleDoc._id}) belongs to in the database. The corresponding membership records will be removed.`,
        );
        await MembershipCollection.deleteMany({ membershipRole: membershipRoleId });

        // Remove membership role in DB
        await MembershipRoleCollection.findByIdAndDelete(membershipRoleId);

        // DM user about the removal
        promises.push(
          ...membershipDocGroup.map((membershipDoc) =>
            DiscordUtility.addJobToQueue(async () => {
              try {
                const user = await client.users.fetch(membershipDoc.user._id);
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

      const youTubeChannel = await YouTubeChannelCollection.findById(
        membershipRoleDoc.youTubeChannel,
      );

      // YouTube channel not found in DB
      if (youTubeChannel === null) {
        // Remove user membership record in DB
        console.error(
          `Failed to find the YouTube channel with ID: ${membershipRoleDoc.youTubeChannel} which the role ${membershipRoleDoc.name}(ID: ${membershipRoleDoc._id}) belongs to in the database. The corresponding membership records will be removed.`,
        );
        await MembershipCollection.deleteMany({ membershipRole: membershipRoleId });

        // DM user about the removal
        promises.push(
          ...membershipDocGroup.map((membershipDoc) =>
            DiscordUtility.addJobToQueue(async () => {
              try {
                const user = await client.users.fetch(membershipDoc.user._id);
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

      // Fetch guild from Discord API
      let guild: Guild | null = null;
      try {
        guild = await client.guilds.fetch({ guild: guildDoc._id, force: true });
      } catch (error) {
        console.error(error);
        console.error(
          `Failed to fetch guild ${guildDoc.name}(ID: ${guildDoc._id}) from Discord API.`,
        );
      }
      if (guild !== null) {
        // Update guild cache in DB
        guildDoc.name = guild.name;
        guildDoc.icon = guild.iconURL();
        await guildDoc.save();
      }

      // Check membership
      promises.push(
        ...membershipDocGroup.map((membershipDoc) =>
          GoogleUtility.addJobToQueue(async () => {
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
                // We assume that user does not have the YouTube channel membership if the API call fails
                console.error(error);
              }
            }

            await DiscordUtility.addJobToQueue(async () => {
              // Remove the role from the user
              let roleRemoved = false;
              let user: User | null = null;
              if (guild !== null) {
                try {
                  const member = await guild.members.fetch(membershipDoc.user._id);
                  user = member.user;
                  await member.roles.remove(membershipRoleDoc._id);
                  roleRemoved = true;
                } catch (error) {
                  console.error(
                    `Failed to remove role ${membershipRoleDoc.name}(ID: ${membershipRoleDoc._id}) from user with ID ${membershipDoc.user._id} in guild ${guild.name}(ID: ${guild.id}).`,
                  );
                }
              }

              // Notify user about the removal
              try {
                if (user === null) user = await client.users.fetch(membershipDoc.user._id);
                await user.send(
                  `Your membership role **@${membershipRoleDoc.name}** has been removed since we cannot verify your membership from YouTube API.\n` +
                    (roleRemoved
                      ? ''
                      : 'However, we cannot remove the membership role from you due to one of the following reasons:\n' +
                        '- You have left the server\n' +
                        '- The membership role has been removed from the server\n' +
                        '- The bot does not have the permission to manage roles\n' +
                        '- The bot is no longer in the server\n' +
                        '- Other unknown bot error\n' +
                        '\nIf you believe this is an error, please contact the server owner or the bot owner to resolve this issue.'),
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
