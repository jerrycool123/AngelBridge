import { Worker, createWorker } from 'tesseract.js';

import Env from './env.js';
import Queue from './queue.js';

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
  private _worker: Worker | null = null;
  private _languageCode: SupportedOCRLanguage['code'] = 'eng';

  public queue = new Queue('OCR Worker', { autoStart: true, concurrency: 1 });

  async init() {
    this._worker = await createWorker({
      langPath: Env.TESSDATA_PATH,
      cachePath: `${Env.TESSDATA_CACHE_PATH}`,
      // logger: (m) => console.log(m),
    });
    await this._worker.loadLanguage(supportedOCRLanguageString);
    await this._worker.initialize(this._languageCode);
  }

  async recognize(languageCode: SupportedOCRLanguage['code'], imageUrl: string) {
    if (this._worker === null) {
      throw new Error('Worker not initialized');
    }

    if (this._languageCode !== languageCode) {
      this._languageCode = languageCode;
      // ! This is a workaround since japanese date isn't correctly recognized
      const actualLanguageCode = languageCode === 'jpn' ? supportedOCRLanguageString : languageCode;
      await this._worker.initialize(actualLanguageCode);
    }
    try {
      const {
        data: { text },
      } = await this._worker.recognize(imageUrl);
      return text;
    } catch (error) {
      console.log(error);
    }
    return null;
  }
}

const ocrWorker = new OCRWorker();

export default ocrWorker;
