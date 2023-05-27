import 'dotenv/config';

export const Env: Record<
  | 'NODE_ENV'
  | 'PORT'
  | 'FRONTEND_URL'
  | 'BACKEND_URL'
  | 'NEXTAUTH_SECRET'
  | 'DATA_ENCRYPTION_SECRET'
  | 'MONGO_URL'
  | 'DISCORD_BOT_TOKEN'
  | 'DISCORD_CLIENT_ID'
  | 'DISCORD_CLIENT_SECRET'
  | 'GOOGLE_CLIENT_ID'
  | 'GOOGLE_CLIENT_SECRET'
  | 'GOOGLE_API_KEY'
  | 'TESSDATA_PATH'
  | 'TESSDATA_CACHE_PATH',
  string
> = process.env as Record<string, string>;

for (const key of Object.keys(Env)) {
  const value = process.env[key];
  if (value == null) {
    throw new Error(`${key} must be defined. Please check your .env file.`);
  }
}
