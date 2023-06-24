import { SupportedOCRLanguage } from '../../types/common.js';

export class OCRConstants {
  public static readonly supportedLanguages: SupportedOCRLanguage[] = [
    { name: 'English', code: 'eng' },
    { name: 'Chinese - Traditional', code: 'chi_tra' },
    { name: 'Chinese - Simplified', code: 'chi_sim' },
    { name: 'German', code: 'deu' },
    { name: 'Filipino', code: 'fil' },
    { name: 'Indonesian', code: 'ind' },
    { name: 'Japanese', code: 'jpn' },
    { name: 'Korean', code: 'kor' },
    { name: 'Malay', code: 'msa' },
    { name: 'Thai', code: 'tha' },
    { name: 'Vietnamese', code: 'vie' },
  ];
}
