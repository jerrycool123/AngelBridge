import { DiscordAuthRequest } from '@angel-bridge/common';
import jwt from 'jsonwebtoken';
import NextAuth, { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

import privateEnv from '../../../libs/private-env';
import publicEnv from '../../../libs/public-env';
import api from '../../../libs/server';

export const authOptions: NextAuthOptions = {
  // Configure one or more authentication providers
  providers: [
    DiscordProvider({
      clientId: publicEnv.NEXT_PUBLIC_DISCORD_CLIENT_ID,
      clientSecret: privateEnv.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: 'identify guilds', prompt: 'consent' } },
    }),
  ],
  callbacks: {
    async signIn({ account }) {
      // TODO: there is refresh token, need to store them.
      if (account === null) return false;
      else if (account.provider === 'discord') {
        const { refresh_token } = account;
        const token = jwt.sign(
          {
            refresh_token,
          },
          privateEnv.NEXTAUTH_SECRET,
        );
        try {
          await api.post<DiscordAuthRequest>('/auth/discord', { token });
        } catch (e) {
          console.error(e);
          return false;
        }

        return true;
      }
      return false;
    },
    jwt({ token, account, profile }) {
      if (account !== null && profile !== undefined) {
        token.user = {
          id: profile.id,
          username: `${profile.username}#${profile.discriminator}`,
          avatar: profile.image_url,
        };
      }
      return token;
    },
    session({ session, token }) {
      session.user = token.user;
      return session;
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
};
export default NextAuth(authOptions);
