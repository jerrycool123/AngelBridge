import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import 'express-async-errors';

import { Env } from '../utils/env.js';
import { NotFoundError } from '../utils/error.js';
import { useAuth } from './middlewares/auth.js';
import errorHandler from './middlewares/error-handler.js';
import router from './route.js';

const app = express();
app.set('trust proxy', 'loopback');

app.use(
  cors({
    origin: Env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use(useAuth);

if (Env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(req.method, req.url);
    console.log(req.body);
    next();
  });
}

app.use('/server', router);

app.all('*', () => {
  throw new NotFoundError();
});

app.use(errorHandler);

export default app;
