import mongoose from 'mongoose';

import { bot } from './bot/index.js';
import app from './express-server/index.js';
import { Env } from './libs/env.js';
import ocrWorker from './libs/ocr.js';
import startCronjobs from './routines/index.js';

const main = async () => {
  // Initialize OCR worker

  await ocrWorker.init();
  console.log('OCR worker initialized');

  // Connect to MongoDB
  await mongoose.connect(Env.MONGO_URL);
  console.log('Connected to MongoDB');

  // Start the server
  app.listen(Env.PORT, () => {
    console.log(`Server is listening on port ${Env.PORT}!`);
  });

  // Start Discord Bot
  await bot.start();

  // Start cron jobs
  startCronjobs();
};

await main();
