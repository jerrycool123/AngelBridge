import mongoose from 'mongoose';

import './type-augmentations/index.js';

import { bot } from './bot/index.js';
import app from './http-server/index.js';
import { Env } from './utils/env.js';

const main = async () => {
  // Initialize OCR worker

  console.log('OCR worker initialized');

  // Connect to MongoDB
  await mongoose.connect(Env.MONGO_URL);
  console.log('Connected to MongoDB');

  // Start Discord Bot
  await bot.start();

  // Start the http server
  app.listen(Env.PORT, () => {
    console.log(`Server is listening on port ${Env.PORT}!`);
  });
};

await main();
