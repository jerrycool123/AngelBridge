type SupportedOCRLanguage =
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
interface CustomCronJob {
  name: string;
  cronjob: import('cron').CronJob;
}

type Intersect<T, U> = {
  [K in Extract<keyof T, keyof U>]: T[K] & U[K];
};

interface CustomBotErrorConfig {
  activeInteraction: import('discord.js').RepliableInteraction;
  followUp: boolean;
}
