import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { BotChecker } from '../../checkers/bot.js';
import MembershipCollection, {
  OAuthMembershipDoc,
  OCRMembershipDoc,
} from '../../models/membership.js';
import { BotCommand, GuildChatInputCommandInteraction } from '../../types/bot.js';
import { BotConstants } from '../constants.js';
import { genericOption } from '../utils/common.js';

dayjs.extend(utc);

export class CheckMemberCommand implements BotCommand<true> {
  public readonly data = new SlashCommandBuilder()
    .setName('check-member')
    .setDescription("Check a member's membership status in this server")
    .setDefaultMemberPermissions(BotConstants.ModeratorPermissions)
    .addUserOption(genericOption('member', 'The member to assign the role to', true));
  public readonly guildOnly = true;
  public readonly botHasManageRolePermission = false;

  public async execute(interaction: GuildChatInputCommandInteraction): Promise<void> {
    const { guild, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Get guild member
    const user = options.getUser('member', true);
    const member = await BotChecker.requireGuildMember(guild, user.id);

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
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: `${member.user.username}#${member.user.discriminator}`,
            iconURL: member.displayAvatarURL(),
          })
          .setTitle(`Membership Status`)
          .addFields([
            {
              name: 'OCR Membership',
              value:
                ocrMembershipDocs.length === 0
                  ? 'None'
                  : ocrMembershipDocs
                      .map(
                        (ocrMembershipDoc) =>
                          `<@${ocrMembershipDoc.user}> (${dayjs
                            .utc(ocrMembershipDoc.billingDate)
                            .format('YYYY/MM/DD')})`,
                      )
                      .join('\n'),
            },
            {
              name: 'OAuth Membership',
              value:
                oauthMembershipDocs.length === 0
                  ? 'None'
                  : oauthMembershipDocs
                      .map((oauthMembershipDoc) => `<@${oauthMembershipDoc.user}>`)
                      .join('\n'),
              inline: true,
            },
          ])
          .setFooter({
            text: `ID: ${member.id}`,
          }),
      ],
    });
  }
}
