import mongoose from 'mongoose';

import client from './bot';
import Env from './libs/env';
import ocrWorker from './libs/ocr';
import app from './server';

const main = async () => {
  // Initialize OCR worker
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
  client.login(Env.DISCORD_BOT_TOKEN);
};

main();
