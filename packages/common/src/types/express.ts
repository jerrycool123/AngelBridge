import { RequestHandler } from 'express';

/* eslint-disable @typescript-eslint/no-explicit-any */

// HTTP Request/Response default type
export interface BaseHttpRequest {
  body: Record<string, never>;
  params: Record<string, never>;
  query: Record<string, never>;
  res: Record<string, never> | Record<string, never>[];
  locals: Record<string, never>;
}

// Custom HTTP Payload
export type CustomHttpRequest<K extends string | number | symbol = never> = Omit<
  BaseHttpRequest,
  K
>;

// Express.js request handler type
export type CustomRequestHandler<P extends Record<keyof BaseHttpRequest, any>> = RequestHandler<
  P['params'],
  P['res'],
  P['body'],
  P['query'],
  P['locals']
>;
