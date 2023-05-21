import { GuildMember, TextChannel } from 'discord.js';

import { symmetricDecrypt } from '../../libs/crypto.js';
import DiscordAPI from '../../libs/discord.js';
import GoogleAPI from '../../libs/google.js';
import GuildCollection from '../../models/guild.js';
import MembershipRoleCollection, { MembershipRoleDoc } from '../../models/membership-role.js';
import MembershipCollection, { OAuthMembershipDoc } from '../../models/membership.js';
import UserCollection, { UserDoc } from '../../models/user.js';
import YouTubeChannelCollection, { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import {
  GuildInfo,
  cleanUpMissingMembershipRole,
  fetchGuild,
  fetchGuildOwner,
  fetchLogChannel,
  groupMembershipDocsByMembershipRole,
  removeUserMembership,
} from '../utils.js';

const checkOAuthMembershipJob = async () => {
  console.log(`[${new Date().toLocaleString('en-US')}] Running OAuth Membership Check routine...`);

  // Get OAuth memberships from DB
  const oauthMembershipDocs = await MembershipCollection.find<OAuthMembershipDoc>({
    type: 'oauth',
  });

  // Get users from DB
  const userDocs = await UserCollection.find({
    _id: { $in: oauthMembershipDocs.map((doc) => doc.user) },
  });
  const userDocRecord = userDocs.reduce<Record<string, UserDoc>>(
    (prev, userDoc) => ({ ...prev, [userDoc._id]: userDoc }),
    {},
  );

  // Group memberships by membership role
  const membershipDocRecord = groupMembershipDocsByMembershipRole(oauthMembershipDocs);

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

    // Get YouTube channel from DB
    const youTubeChannelId = membershipRoleDoc.youTubeChannel;
    const youTubeChannelDoc = await YouTubeChannelCollection.findById(youTubeChannelId);
    const youTubeChannelString =
      youTubeChannelDoc !== null
        ? `\`${youTubeChannelDoc.title}\``
        : `with ID: ${youTubeChannelId}`;
    if (youTubeChannelDoc === null) {
      console.error(
        `Failed to find the YouTube channel with ID: ${youTubeChannelId} which the role with ID: ${membershipRoleId}) belongs to in the database. ` +
          'The corresponding membership records will be removed.',
      );
      promises.push(
        ...(await cleanUpMissingMembershipRole(
          membershipRoleId,
          membershipDocGroup,
          `its corresponding YouTube channel ${youTubeChannelString} has been removed from our database`,
          guildOwner,
          logChannel,
        )),
      );
      continue;
    }

    // Check membership
    let guildInfo: GuildInfo;
    if (guild !== null) {
      guildInfo = { type: 'guild', data: guild };
    } else {
      guildInfo = { type: 'partialGuild', data: { id: guildId, name: guildDoc.name } };
    }
    promises.push(
      ...membershipDocGroup.map(async (membershipDoc) => {
        const userId = membershipDoc.user;
        const userDoc = userId in userDocRecord ? userDocRecord[userId] : null;
        await checkOAuthMembership({
          membershipDoc,
          membershipRoleDoc,
          userDoc,
          youTubeChannelDoc,
          guildInfo,
          guildOwner,
          logChannel,
        });
      }),
    );
  }

  await Promise.all(promises);
  console.log(`[${new Date().toLocaleString('en-US')}] OAuth Membership Check routine completed.`);
};

export const checkOAuthMembership = async ({
  membershipDoc,
  membershipRoleDoc,
  userDoc,
  youTubeChannelDoc,
  guildInfo,
  guildOwner,
  logChannel,
}: {
  membershipDoc: OAuthMembershipDoc;
  membershipRoleDoc: MembershipRoleDoc;
  userDoc: UserDoc | null;
  youTubeChannelDoc: YouTubeChannelDoc;
  guildInfo: GuildInfo;
  guildOwner: GuildMember | null;
  logChannel: TextChannel | null;
}) => {
  // Verify the user's membership via Google API
  let refreshToken: string | null = null;
  if (userDoc?.youTube != null) {
    refreshToken = symmetricDecrypt(userDoc.youTube.refreshToken);
  }

  let verifySuccess = false;
  await GoogleAPI.addJob(async () => {
    if (refreshToken !== null) {
      for (let retry = 0; retry < 3; retry++) {
        const randomVideoId =
          youTubeChannelDoc.memberOnlyVideoIds[
            Math.floor(Math.random() * youTubeChannelDoc.memberOnlyVideoIds.length)
          ];
        const result = await GoogleAPI.verifyYouTubeMembership(refreshToken, randomVideoId);
        if (result.success === true) break;
        else if (result.error === 'forbidden' || result.error === 'token_expired_or_revoked') {
          verifySuccess = false;
          break;
        } else if (result.error === 'video_not_found' || result.error === 'comment_disabled') {
          // Try again for another random members-only video
          continue;
        } else {
          // Unknown error, currently we do not retry
          break;
        }
      }
    }
  });

  // If the user has the membership, we do nothing
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (verifySuccess === true) return;

  // If not, we remove the membership from the user
  await DiscordAPI.addJob(async () =>
    removeUserMembership({
      membershipDoc,
      membershipRoleDoc,
      guildInfo,
      guildOwner,
      logChannel,
    }),
  );
};

export default checkOAuthMembershipJob;
