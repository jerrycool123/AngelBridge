import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { SlashCommandBuilder } from 'discord.js';

import MembershipCollection, {
  OAuthMembershipDoc,
  OCRMembershipDoc,
} from '../../../models/membership.js';
import { Bot, BotCommandTrigger, GuildChatInputCommandInteraction } from '../../../types/bot.js';
import { NotFoundError } from '../../../utils/error.js';
import { BotEmbeds } from '../../components/embeds.js';
import { BotConfig } from '../../config.js';
import { BotCheckers } from '../../utils/index.js';

dayjs.extend(utc);

export class CheckMemberCommandTrigger implements BotCommandTrigger<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('check-member')
    .setDescription("Check a member's membership status in this server")
    .setDefaultMemberPermissions(BotConfig.ModeratorPermissions)
    .addGenericUserOption('member', 'The member to assign the role to', true);
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = false;

  public async execute(bot: Bot, interaction: GuildChatInputCommandInteraction): Promise<void> {
    const { guild, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Get guild member
    const user = options.getUser('member', true);
    const member = await BotCheckers.fetchGuildMember(guild, user.id);
    if (member === null) {
      throw new NotFoundError(`The user <@${user.id}> is not a member of the server.`);
    }

    // Get membership status from database
    const membershipDocs = await MembershipCollection.find({
      user: member.id,
    });
    const ocrMembershipDocs: OCRMembershipDoc[] = [],
      oauthMembershipDocs: OAuthMembershipDoc[] = [];
    for (const membershipDoc of membershipDocs) {
      if (membershipDoc.type === 'ocr') {
        ocrMembershipDocs.push(membershipDoc as OCRMembershipDoc);
      } else {
        oauthMembershipDocs.push(membershipDoc as OAuthMembershipDoc);
      }
    }

    // Organize membership status to embed and display
    const membershipStatusEmbed = BotEmbeds.createMembershipStatusEmbed(
      member.user,
      ocrMembershipDocs,
      oauthMembershipDocs,
    );
    await interaction.genericReply({
      embeds: [membershipStatusEmbed],
    });
  }
}
