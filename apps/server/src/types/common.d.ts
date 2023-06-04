import { Guild, GuildMember, TextChannel } from 'discord.js';

export type SupportedOCRLanguage =
  | { name: 'English'; code: 'eng' }
  | { name: 'Chinese - Traditional'; code: 'chi_tra' }
  | { name: 'Chinese - Simplified'; code: 'chi_sim' }
  | { name: 'German'; code: 'deu' }
  | { name: 'Filipino'; code: 'fil' }
  | { name: 'Indonesian'; code: 'ind' }
  | { name: 'Japanese'; code: 'jpn' }
  | { name: 'Korean'; code: 'kor' }
  | { name: 'Malay'; code: 'msa' }
  | { name: 'Thai'; code: 'tha' }
  | { name: 'Vietnamese'; code: 'vie' };

export type BooleanOrFalse<T extends boolean> = T extends true ? boolean : false;

export interface UserMeta {
  id: string;
  username: string;
  avatar: string;
}

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  description: string;
  customUrl: string;
  thumbnail: string;
}

export interface RecognizedDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface EventLogConfig {
  guild?: Guild | null;
  guildOwner?: GuildMember | null;
  logChannel?: TextChannel | null;
}
