import mongoose from 'mongoose';

import client from './bot/index.js';
import Env from './libs/env.js';
import ocrWorker from './libs/ocr.js';
import startCronjobs from './routines/index.js';
import app from './server/index.js';

const main = async () => {
  // Initialize OCR worker
  // throw new Error('TODO: emoji action of moderators to verify membership');

  ocrWorker.init().then(() => {
    console.log('OCR worker initialized');
  });

  // Connect to MongoDB
  mongoose.connect(Env.MONGO_URL).then(() => {
    console.log('Connected to MongoDB');
  });

  // Start the server
  app.listen(Env.PORT, () => {
    console.log(`Server is listening on port ${Env.PORT}!`);
  });

  // Login to Discord
  await client.login(Env.DISCORD_BOT_TOKEN);

  // Start cron jobs
  startCronjobs();
};

await main();
