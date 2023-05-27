import { symmetricDecrypt } from '../../libs/crypto.js';
import DiscordAPI from '../../libs/discord.js';
import GoogleAPI from '../../libs/google.js';
import {
  MembershipHandlingConfig,
  fetchGuild,
  fetchGuildOwner,
  fetchLogChannel,
  groupMembershipDocsByMembershipRole,
  removeMembershipRole,
  removeUserMembership,
} from '../../libs/membership.js';
import GuildCollection from '../../models/guild.js';
import MembershipRoleCollection, { MembershipRoleDoc } from '../../models/membership-role.js';
import MembershipCollection, { OAuthMembershipDoc } from '../../models/membership.js';
import UserCollection, { UserDoc } from '../../models/user.js';
import YouTubeChannelCollection, { YouTubeChannelDoc } from '../../models/youtube-channel.js';

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
  for (const [membershipRoleId, membershipDocGroup] of Object.entries(membershipDocRecord)) {
    if (membershipDocGroup.length === 0) continue;
    const common = { membershipDocGroup, membershipRoleId };

    console.log(`Checking membership role with ID: ${membershipRoleId}...`);

    // Get membership role from DB
    const membershipRoleDoc = await MembershipRoleCollection.findById(membershipRoleId);
    if (membershipRoleDoc === null) {
      console.error(
        `Failed to find membership role with ID: ${membershipRoleId} in the database. ` +
          'The corresponding membership records will be removed.',
      );
      promises.push(
        ...(await removeMembershipRole({
          ...common,
          removeReason: 'it is removed from our database',
        })),
      );
      continue;
    }

    // Fetch guild from Discord bot
    const guildId = membershipRoleDoc.guild;
    const guild = await fetchGuild(guildId);
    const guildString = guild !== null ? `\`${guild.name}\`` : `with ID: ${guildId}`;

    // Fetch guild owner from Discord bot
    const guildOwner = await fetchGuildOwner(guild, false);

    // Get guild from DB
    const guildDoc = await GuildCollection.findById(guildId);
    if (guildDoc === null) {
      console.error(
        `Failed to find the server with ID: ${guildId} which the role with ID: ${membershipRoleId} belongs to in the database. ` +
          'The corresponding membership records will be removed.',
      );
      promises.push(
        ...(await removeMembershipRole({
          ...common,
          removeReason: `its parent server ${guildString} has been removed from our database`,
          guild,
          guildOwner,
        })),
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
        ...(await removeMembershipRole({
          ...common,
          removeReason: `its corresponding YouTube channel ${youTubeChannelString} has been removed from our database`,
          guild,
          guildOwner,
          logChannel,
        })),
      );
      continue;
    }

    // Check membership
    promises.push(
      ...membershipDocGroup.map(async (membershipDoc) => {
        const userId = membershipDoc.user;
        const userDoc = userId in userDocRecord ? userDocRecord[userId] : null;
        await checkOAuthMembership({
          membershipDoc,
          membershipRoleDoc,
          userDoc,
          youTubeChannelDoc,
          guild,
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
  ...config
}: {
  membershipDoc: OAuthMembershipDoc;
  membershipRoleDoc: MembershipRoleDoc;
  userDoc: UserDoc | null;
  youTubeChannelDoc: YouTubeChannelDoc;
} & MembershipHandlingConfig) => {
  // Verify the user's membership via Google API
  let refreshToken: string | null = null;
  if (userDoc?.youTube != null) {
    refreshToken = symmetricDecrypt(userDoc.youTube.refreshToken);
  }

  const result = await GoogleAPI.queue.add(async () => {
    if (refreshToken !== null) {
      for (let retry = 0; retry < 3; retry++) {
        const randomVideoId =
          youTubeChannelDoc.memberOnlyVideoIds[
            Math.floor(Math.random() * youTubeChannelDoc.memberOnlyVideoIds.length)
          ];
        const result = await GoogleAPI.verifyYouTubeMembership(refreshToken, randomVideoId);
        if (result.success === true) {
          return true;
        } else if (result.error === 'forbidden' || result.error === 'token_expired_or_revoked') {
          return false;
        } else if (result.error === 'video_not_found' || result.error === 'comment_disabled') {
          // Try again for another random members-only video
          continue;
        } else {
          // Unknown error, currently we do not retry
          return true;
        }
      }
      return true;
    }
    return false;
  });

  // If the user has the membership, we do nothing
  if (result.success === true && result.value === true) return;

  // If not, we remove the membership from the user
  await DiscordAPI.queue.add(async () =>
    removeUserMembership({
      membershipDoc,
      membershipRoleData: membershipRoleDoc,
      removeReason: 'we cannot verify your membership from YouTube API',
      ...config,
    }),
  );
};

export default checkOAuthMembershipJob;
