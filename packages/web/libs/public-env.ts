/* eslint-disable @typescript-eslint/no-non-null-assertion */
const publicEnv = {
  NEXT_PUBLIC_DISCORD_CLIENT_ID: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL!,
};

Object.entries(publicEnv).forEach(([key, value]) => {
  if (value == null) {
    throw new Error(`${key} must be defined.`);
  }
});

export default publicEnv;
