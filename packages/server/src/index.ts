import mongoose from 'mongoose';

import app from './app/index.js';
import client from './bot/index.js';
import Env from './libs/env.js';
import ocrWorker from './libs/ocr.js';
import startCronjobs from './routines/index.js';

const main = async () => {
  // Initialize OCR worker

  ocrWorker
    .init()
    .then(() => console.log('OCR worker initialized'))
    .catch(console.error);

  // Connect to MongoDB
  mongoose
    .connect(Env.MONGO_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch(console.error);

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
