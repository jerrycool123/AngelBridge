import PQueue from 'p-queue';
import { Worker, createWorker } from 'tesseract.js';

import Env from './env.js';

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
  private jobQueue: PQueue = new PQueue({ autoStart: true, concurrency: 1 });

  async init() {
    this.worker = await createWorker({
      langPath: Env.TESSDATA_PATH,
      cachePath: `${Env.TESSDATA_CACHE_PATH}`,
      // logger: (m) => console.log(m),
    });
    await this.worker.loadLanguage(supportedOCRLanguageString);
    await this.worker.initialize(this.languageCode);
  }

  async recognize(languageCode: SupportedOCRLanguage['code'], imageUrl: string) {
    if (this.worker === null) {
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

  addJob(promise: Promise<unknown>) {
    void this.jobQueue.add(async () => {
      try {
        await promise;
      } catch (error) {
        console.error('An error occurred while executing a OCR job:');
        console.log(error);
      }
    });
  }
}

const ocrWorker = new OCRWorker();

export default ocrWorker;
