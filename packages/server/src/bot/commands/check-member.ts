import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import MembershipCollection, {
  OAuthMembershipDoc,
  OCRMembershipDoc,
} from '../../models/membership.js';
import DiscordBotConfig from '../config.js';
import { requireGuildMember } from '../utils/checker.js';
import { genericOption } from '../utils/common.js';
import { useGuildOnly } from '../utils/validator.js';
import CustomBotCommand from './index.js';

dayjs.extend(utc);

const check_member = new CustomBotCommand({
  data: new SlashCommandBuilder()
    .setName('check-member')
    .setDescription("Check a member's membership status in this server")
    .setDefaultMemberPermissions(DiscordBotConfig.moderatorPermissions)
    .addUserOption(genericOption('member', 'The member to assign the role to', true)),
  execute: useGuildOnly(async (interaction) => {
    const { guild, options } = interaction;

    await interaction.deferReply({ ephemeral: true });

    // Get guild member
    const user = options.getUser('member', true);
    const member = await requireGuildMember(interaction, guild, user.id);

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
  }),
});

export default check_member;
