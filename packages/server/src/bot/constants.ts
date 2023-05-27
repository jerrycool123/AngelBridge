import { GatewayIntentBits, PermissionFlagsBits } from 'discord.js';

export class BotConstants {
  public static readonly Intents = [GatewayIntentBits.Guilds];
  public static readonly ModeratorPermissions = PermissionFlagsBits.ManageRoles;
}
