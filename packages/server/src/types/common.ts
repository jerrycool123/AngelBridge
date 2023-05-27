import { CronJob } from 'cron';

export type SupportedOCRLanguage =
  | {
      language: 'English';
      code: 'eng';
    }
  | {
      language: 'Chinese - Traditional';
      code: 'chi_tra';
    }
  | {
      language: 'Chinese - Simplified';
      code: 'chi_sim';
    }
  | {
      language: 'German';
      code: 'deu';
    }
  | {
      language: 'Filipino';
      code: 'fil';
    }
  | {
      language: 'Indonesian';
      code: 'ind';
    }
  | {
      language: 'Japanese';
      code: 'jpn';
    }
  | {
      language: 'Korean';
      code: 'kor';
    }
  | {
      language: 'Malay';
      code: 'msa';
    }
  | {
      language: 'Thai';
      code: 'tha';
    }
  | {
      language: 'Vietnamese';
      code: 'vie';
    };
export interface CustomCronJob {
  name: string;
  cronjob: CronJob;
}

export type Intersect<T, U> = {
  [K in Extract<keyof T, keyof U>]: T[K] & U[K];
};

export type BooleanOrFalse<T extends boolean> = T extends true ? boolean : false;
