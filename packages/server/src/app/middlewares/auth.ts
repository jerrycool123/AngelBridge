import { NextFunction, Request, RequestHandler, Response } from 'express';
import { decode } from 'next-auth/jwt';

import Env from '../../libs/env.js';
import { UnauthorizedError } from '../../libs/error.js';

export interface Session {
  id: string;
  username: string;
  avatar: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    session?: Session;
  }
}

export const useAuth: RequestHandler = async (req, res, next) => {
  // Authorization Header
  const cookies = req.cookies as unknown;
  const token =
    typeof cookies === 'object' && cookies !== null
      ? '__Secure-next-auth.session-token' in cookies &&
        typeof cookies['__Secure-next-auth.session-token'] === 'string'
        ? cookies['__Secure-next-auth.session-token']
        : 'next-auth.session-token' in cookies &&
          typeof cookies['next-auth.session-token'] === 'string'
        ? cookies['next-auth.session-token']
        : undefined
      : undefined;

  try {
    const payload = (await decode({ token, secret: Env.NEXTAUTH_SECRET })) as unknown;
    if (
      payload !== null &&
      typeof payload === 'object' &&
      'user' in payload &&
      payload.user !== null &&
      typeof payload.user === 'object' &&
      'id' in payload.user &&
      typeof payload.user.id === 'string' &&
      'username' in payload.user &&
      typeof payload.user.username === 'string' &&
      'avatar' in payload.user &&
      typeof payload.user.avatar === 'string'
    ) {
      const { id, username, avatar } = payload.user;
      req.session = { id, username, avatar };
    }
  } catch (err) {
    // pass
    console.error(err);
  }

  return next();
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  if (req.session === undefined) {
    throw new UnauthorizedError();
  }

  next();
};

export const getSession = (req: Request) => {
  if (req.session === undefined) {
    throw new UnauthorizedError();
  }

  return req.session;
};
