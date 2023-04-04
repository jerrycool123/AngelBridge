import Queue from 'queue';
import { Worker, createWorker } from 'tesseract.js';

import Env from './env';

export const supportedOCRLanguages: SupportedOCRLanguage[] = [
  {
    language: 'English',
    code: 'eng',
  },
  {
    language: 'Chinese - Traditional',
    code: 'chi_tra',
  },
  {
    language: 'Chinese - Simplified',
    code: 'chi_sim',
  },
  {
    language: 'German',
    code: 'deu',
  },
  {
    language: 'Filipino',
    code: 'fil',
  },
  {
    language: 'Indonesian',
    code: 'ind',
  },
  {
    language: 'Japanese',
    code: 'jpn',
  },
  {
    language: 'Korean',
    code: 'kor',
  },
  {
    language: 'Malay',
    code: 'msa',
  },
  {
    language: 'Thai',
    code: 'tha',
  },
  {
    language: 'Vietnamese',
    code: 'vie',
  },
];

const supportedOCRLanguageString = supportedOCRLanguages.map((lang) => lang.code).join('+');
class OCRWorker {
  private worker: Worker | null = null;
  private languageCode: SupportedOCRLanguage['code'] = 'eng';
  private jobQueue: Queue = new Queue({ concurrency: 1, autostart: true });

  constructor() {
    this.jobQueue.on('timeout', (e) => {
      console.log(e);
    });
  }

  async init() {
    // TODO: multiple languages
    // TODO: research how VeraBot detect talent names

    this.worker = await createWorker({
      langPath: Env.TESSDATA_PATH,
      cachePath: `${Env.TESSDATA_CACHE_PATH}`,
      // logger: (m) => console.log(m),
    });
    await this.worker.loadLanguage(supportedOCRLanguageString);
    await this.worker.initialize(this.languageCode);
  }

  async recognize(languageCode: SupportedOCRLanguage['code'], imageUrl: string) {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    if (this.languageCode !== languageCode) {
      this.languageCode = languageCode;
      // ! This is a workaround since japanese date isn't correctly recognized
      const actualLanguageCode = languageCode === 'jpn' ? supportedOCRLanguageString : languageCode;
      await this.worker.initialize(actualLanguageCode);
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

  addJob(func: (...args: unknown[]) => void) {
    this.jobQueue.push(func);
  }
}

const ocrWorker = new OCRWorker();

export default ocrWorker;
