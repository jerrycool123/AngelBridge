/* eslint-disable @typescript-eslint/no-non-null-assertion */
const privateEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET!,
};

Object.entries(privateEnv).forEach(([key, value]) => {
  if (value == null) {
    throw new Error(`${key} must be defined.`);
  }
});

export default privateEnv;
