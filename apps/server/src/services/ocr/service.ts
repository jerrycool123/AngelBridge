import { Worker, createWorker } from 'tesseract.js';

import { RecognizedDate, SupportedOCRLanguage } from '../../types/common.js';
import { Env } from '../../utils/env.js';
import { InternalServerError } from '../../utils/error.js';
import { Queue } from '../../utils/queue.js';
import { OCRBillingDateParser } from './billing-date-parser.js';
import { OCRConstants } from './constants.js';

export class OCRService {
  private readonly supportedLangString = OCRConstants.supportedLanguages
    .map((lang) => lang.code)
    .join('+');
  private readonly queue = new Queue('OCR Worker', { autoStart: true, concurrency: 1 });
  private initialized = false;
  private worker: Worker | null = null;
  private langCode: SupportedOCRLanguage['code'] = 'eng';

  public async recognizeBillingDate(
    imageUrl: string,
    langCode: SupportedOCRLanguage['code'],
  ): Promise<RecognizedDate> {
    const rawText = await this.recognizeText(langCode, imageUrl);
    return OCRBillingDateParser.parseDate(rawText, langCode);
  }

  private async init(): Promise<void> {
    this.worker = await createWorker({
      langPath: Env.TESSDATA_PATH,
      cachePath: `${Env.TESSDATA_CACHE_PATH}`,
      // logger: (m) => console.log(m),
    });
    await this.worker.loadLanguage(this.supportedLangString);
    await this.worker.initialize(this.langCode);

    this.initialized = true;
  }

  private async recognizeText(
    langCode: SupportedOCRLanguage['code'],
    imageUrl: string,
  ): Promise<string> {
    if (this.initialized === false) {
      await this.init();
    }

    if (this.worker === null) {
      throw new InternalServerError('Worker not initialized');
    } else if (this.langCode !== langCode) {
      this.langCode = langCode;
      // ! This is a workaround since japanese date isn't correctly recognized
      const actualLangCode = langCode === 'jpn' ? this.supportedLangString : langCode;
      await this.worker.initialize(actualLangCode);
    }

    const result = await this.queue.add(async () => {
      if (this.worker === null) {
        throw new InternalServerError('Worker not initialized');
      }
      const {
        data: { text },
      } = await this.worker.recognize(imageUrl);
      return text;
    });
    if (result.success === false) {
      throw new InternalServerError('An unknown error occurred while recognizing image');
    }
    return result.value;
  }
}
