/* eslint-disable @typescript-eslint/no-unused-vars */
import { UserPayload } from '@angel-bridge/common';
import NextAuth from 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: UserPayload;
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the second parameter of the `session` callback, when using a database.
   */
  type User = UserPayload;

  /**
   * Usually contains information about the provider being used
   * and also extends `TokenSet`, which is different tokens returned by OAuth Providers.
   */
  interface Account {
    refresh_token: string;
  }

  /** The OAuth profile returned from your provider */
  interface Profile {
    id: string;
    username: string;
    discriminator: string;
    image_url: string;
  }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    user: UserPayload;
  }
}
