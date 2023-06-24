import { GatewayIntentBits, PermissionFlagsBits } from 'discord.js';

export class BotConstants {
  public static readonly Intents = [GatewayIntentBits.Guilds];
  public static readonly ModeratorPermissions = PermissionFlagsBits.ManageRoles;
  public static readonly AdminMembershipVerificationActionId = {
    accept: 'membership-accept',
    reject: 'membership-reject',
    modify: 'membership-modify',
  } as const;
}
