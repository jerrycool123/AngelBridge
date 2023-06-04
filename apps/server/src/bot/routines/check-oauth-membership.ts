import GuildCollection from '../../models/guild.js';
import MembershipRoleCollection, { MembershipRoleDoc } from '../../models/membership-role.js';
import MembershipCollection, { OAuthMembershipDoc } from '../../models/membership.js';
import UserCollection, { UserDoc } from '../../models/user.js';
import YouTubeChannelCollection, { YouTubeChannelDoc } from '../../models/youtube-channel.js';
import { MembershipService } from '../../services/membership/index.js';
import { Bot, BotRoutine } from '../../types/bot.js';
import { CryptoUtils } from '../../utils/crypto.js';
import DiscordAPI from '../../utils/discord.js';
import GoogleAPI from '../../utils/google.js';

export class CheckOAuthMembershipRoutine implements BotRoutine {
  public readonly name = 'Check OAuth Membership';
  public readonly schedule = '0 0 * * *';

  public async execute(bot: Bot): Promise<void> {
    console.log(
      `[${new Date().toLocaleString('en-US')}] Running OAuth Membership Check routine...`,
    );

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
    const membershipDocRecord =
      MembershipService.groupMembershipDocsByMembershipRole(oauthMembershipDocs);

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

      // Remove membership role and records if guild does not exist in DB
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
          membershipService.removeMembershipRole({
            membershipDocGroup,
            membershipRoleId,
            removeReason: `its corresponding YouTube channel ${youTubeChannelString} has been removed from our database`,
          }),
        );
        continue;
      }

      // Check membership
      promises.push(
        ...membershipDocGroup.map(async (membershipDoc) => {
          const userId = membershipDoc.user;
          const userDoc = userId in userDocRecord ? userDocRecord[userId] : null;
          await this.checkOAuthMembership({
            membershipDoc,
            membershipRoleDoc,
            userDoc,
            youTubeChannelDoc,
            membershipService,
          });
        }),
      );
    }

    await Promise.all(promises);
    console.log(
      `[${new Date().toLocaleString('en-US')}] OAuth Membership Check routine completed.`,
    );
  }

  public async checkOAuthMembership({
    membershipDoc,
    membershipRoleDoc,
    userDoc,
    youTubeChannelDoc,
    membershipService,
  }: {
    membershipDoc: OAuthMembershipDoc;
    membershipRoleDoc: MembershipRoleDoc;
    userDoc: UserDoc | null;
    youTubeChannelDoc: YouTubeChannelDoc;
    membershipService: MembershipService;
  }) {
    // Verify the user's membership via Google API
    let refreshToken: string | null = null;
    if (userDoc?.youTube != null) {
      refreshToken = CryptoUtils.decrypt(userDoc.youTube.refreshToken);
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
      membershipService.removeMembership({
        membershipDoc,
        membershipRoleData: membershipRoleDoc,
        removeReason: 'we cannot verify your membership from YouTube API',
      }),
    );
  }
}
