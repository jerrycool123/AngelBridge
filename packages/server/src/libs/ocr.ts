import { Worker, createWorker } from 'tesseract.js';

import Env from './env';

class OCRWorker {
  private worker: Worker | null = null;

  async init() {
    // TODO: multiple languages
    // TODO: research how VeraBot detect talent names

    this.worker = await createWorker({
      langPath: Env.TESSDATA_PATH,
      cachePath: `${Env.TESSDATA_CACHE_PATH}`,
      // logger: (m) => console.log(m),
    });
    await this.worker.loadLanguage('eng');
    await this.worker.initialize('eng');
  }

  async recognize(imageUrl: string) {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }
    try {
      const {
        data: { text },
      } = await this.worker.recognize(imageUrl);
      return text;
    } catch (error) {
      console.log(error);
    }
    return null;
  }
}

const ocrWorker = new OCRWorker();

export default ocrWorker;
