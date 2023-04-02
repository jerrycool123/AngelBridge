import 'dotenv/config';

const Env = {
  PORT: '',
  MONGO_URL: '',
  DISCORD_BOT_TOKEN: '',
  DISCORD_BOT_CLIENT_ID: '',
  TESSDATA_PATH: '',
  TESSDATA_CACHE_PATH: '',
  GOOGLE_API_KEY: '',
};

for (const key of Object.keys(Env)) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} must be defined. Please check your .env file.`);
  } else {
    Env[key as keyof typeof Env] = value;
  }
}

export default Env;
