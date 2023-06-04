import { RecognizedDate, SupportedOCRLanguage } from '../../types/common.js';
import { NotImplementedError } from '../../utils/error.js';

export class OCRBillingDateParser {
  public static parseDate(rawText: string, langCode: SupportedOCRLanguage['code']): RecognizedDate {
    let text = rawText;

    /**
     * post-process raw text
     */

    // replace full-width characters with half-width characters
    text = text.replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    // replace small form variant colon
    text = text.replace(/\ufe55/g, ':');
    // replace enclosed alphanumeric characters with their corresponding numbers
    text = text.replace(/[\u2460-\u2468]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x245f));
    text = text.replace(/[\u2469-\u2473]/g, (c) => (c.charCodeAt(0) - 0x245f).toString());
    // replace spaces with empty string
    const lines = text.split('\n').map((line) => line.replace(/\s/g, ''));

    /**
     * i18n date parser
     */

    switch (langCode) {
      case 'eng':
        return OCRBillingDateParser.parseEngDate(lines);
      case 'chi_tra':
        return OCRBillingDateParser.parseChiTraDate(lines);
      case 'chi_sim':
        return OCRBillingDateParser.parseChiSimDate(lines);
      case 'deu':
        return OCRBillingDateParser.parseDeuDate(lines);
      case 'fil':
        return OCRBillingDateParser.parseFilDate(lines);
      case 'ind':
        return OCRBillingDateParser.parseIndDate(lines);
      case 'jpn':
        return OCRBillingDateParser.parseJpnDate(lines);
      case 'kor':
        return OCRBillingDateParser.parseKorDate(lines);
      case 'msa':
        return OCRBillingDateParser.parseMsaDate(lines);
      case 'tha':
        return OCRBillingDateParser.parseThaDate(lines);
      case 'vie':
        return OCRBillingDateParser.parseVieDate(lines);
      default:
        throw new NotImplementedError();
    }
  }

  public static getEmptyDate(): RecognizedDate {
    return { year: null, month: null, day: null };
  }

  private static parseEngDate(lines: string[]): RecognizedDate {
    const regex =
      /Nextbillingdate:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{1,2}),(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match !== null) {
        const abbreviatedMonth = match[1];
        const monthMap: Record<string, number> = {
          Jan: 1,
          Feb: 2,
          Mar: 3,
          Apr: 4,
          May: 5,
          Jun: 6,
          Jul: 7,
          Aug: 8,
          Sep: 9,
          Oct: 10,
          Nov: 11,
          Dec: 12,
        };
        const month = monthMap[abbreviatedMonth];
        const [day, year] = match.slice(2, 4).map((s) => parseInt(s, 10));
        return { year, month, day };
      }
    }
    return OCRBillingDateParser.getEmptyDate();
  }

  private static parseChiTraDate(lines: string[]): RecognizedDate {
    const regex = /帳單日期:(\d{4})年(\d{1,2})月(\d{1,2})日/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match !== null) {
        const [year, month, day] = match.slice(1, 4).map((s) => parseInt(s, 10));
        return { year, month, day };
      }
    }
    return OCRBillingDateParser.getEmptyDate();
  }

  private static parseChiSimDate(lines: string[]): RecognizedDate {
    const regex = /结算日期:(\d{4})年(\d{1,2})月(\d{1,2})日/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match !== null) {
        const [year, month, day] = match.slice(1, 4).map((s) => parseInt(s, 10));
        return { year, month, day };
      }
    }
    return OCRBillingDateParser.getEmptyDate();
  }

  private static parseDeuDate(lines: string[]): RecognizedDate {
    const regex = /NächstesAbrechnungsdatum:(\d{1,2})\.(\d{1,2})\.(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match !== null) {
        const [day, month, year] = match.slice(1, 4).map((s) => parseInt(s, 10));
        return { year, month, day };
      }
    }
    return OCRBillingDateParser.getEmptyDate();
  }

  private static parseFilDate(lines: string[]): RecognizedDate {
    const regex =
      /Susunodnapetsangpagsingil:(Ene|Peb|Mar|Abr|Mayo|Hun|Hul|Ago|Set|Okt|Nob|Dis)(\d{1,2}),(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match !== null) {
        const abbreviatedMonth = match[1];
        const monthMap: Record<string, number> = {
          Ene: 1,
          Peb: 2,
          Mar: 3,
          Abr: 4,
          Mayo: 5,
          Hun: 6,
          Hul: 7,
          Ago: 8,
          Set: 9,
          Okt: 10,
          Nob: 11,
          Dis: 12,
        };
        const month = monthMap[abbreviatedMonth];
        const [day, year] = match.slice(2, 4).map((s) => parseInt(s, 10));
        return { year, month, day };
      }
    }
    return OCRBillingDateParser.getEmptyDate();
  }

  private static parseIndDate(lines: string[]): RecognizedDate {
    const regex =
      /Tanggalpenagihanberikutnya:(\d{1,2})(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match !== null) {
        const abbreviatedMonth = match[2];
        const monthMap: Record<string, number> = {
          Jan: 1,
          Feb: 2,
          Mar: 3,
          Apr: 4,
          Mei: 5,
          Jun: 6,
          Jul: 7,
          Agu: 8,
          Sep: 9,
          Okt: 10,
          Nov: 11,
          Des: 12,
        };
        const month = monthMap[abbreviatedMonth];
        const [day, , year] = match.slice(1, 4).map((s) => parseInt(s, 10));
        return { year, month, day };
      }
    }
    return OCRBillingDateParser.getEmptyDate();
  }

  private static parseJpnDate(lines: string[]): RecognizedDate {
    const regex = /次回請求日:(\d{4})\/(\d{2})\/(\d{2})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match !== null) {
        const [year, month, day] = match.slice(1, 4).map((s) => parseInt(s, 10));
        return { year, month, day };
      }
    }
    return OCRBillingDateParser.getEmptyDate();
  }

  private static parseKorDate(lines: string[]): RecognizedDate {
    const regex = /다음결제일:(\d{4})\.(\d{1,2})\.(\d{1,2})\./;
    for (const line of lines) {
      const match = line.match(regex);
      if (match !== null) {
        const [year, month, day] = match.slice(1, 4).map((s) => parseInt(s, 10));
        return { year, month, day };
      }
    }
    return OCRBillingDateParser.getEmptyDate();
  }

  private static parseMsaDate(lines: string[]): RecognizedDate {
    const regex =
      /Tarikhpengebilanseterusnya:(\d{1,2})(Jan|Feb|Mac|Apr|Mei|Jun|Jul|Ogos|Sep|Okt|Nov|Dis)(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match !== null) {
        const abbreviatedMonth = match[2];
        const monthMap: Record<string, number> = {
          Jan: 1,
          Feb: 2,
          Mac: 3,
          Apr: 4,
          Mei: 5,
          Jun: 6,
          Jul: 7,
          Ogos: 8,
          Sep: 9,
          Okt: 10,
          Nov: 11,
          Dis: 12,
        };
        const month = monthMap[abbreviatedMonth];
        const [day, , year] = match.slice(1, 4).map((s) => parseInt(s, 10));
        return { year, month, day };
      }
    }
    return OCRBillingDateParser.getEmptyDate();
  }

  private static parseThaDate(lines: string[]): RecognizedDate {
    const regex =
      /เรียกเก็บเงินครั้งถัดไปในวันที่(\d{1,2})(ม.ค.|ก.พ.|มี.ค.|เม.ย.|พ.ค.|มิ.ย.|ก.ค.|ส.ค.|ก.ย.|ต.ค.|พ.ย.|ธ.ค.)(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match !== null) {
        const abbreviatedMonth = match[2];
        const monthMap: Record<string, number> = {
          'ม.ค.': 1,
          'ก.พ.': 2,
          'มี.ค.': 3,
          'เม.ย.': 4,
          'พ.ค.': 5,
          'มิ.ย.': 6,
          'ก.ค.': 7,
          'ส.ค.': 8,
          'ก.ย.': 9,
          'ต.ค.': 10,
          'พ.ย.': 11,
          'ธ.ค.': 12,
        };
        const month = monthMap[abbreviatedMonth];
        const [day, , year] = match.slice(1, 4).map((s) => parseInt(s, 10));
        return { year, month, day };
      }
    }
    return OCRBillingDateParser.getEmptyDate();
  }

  private static parseVieDate(lines: string[]): RecognizedDate {
    const regex = /Ngàythanhtoántiếptheo:(\d{1,2})thg(\d{1,2}),(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match !== null) {
        const [day, month, year] = match.slice(1, 4).map((s) => parseInt(s, 10));
        return { year, month, day };
      }
    }
    return OCRBillingDateParser.getEmptyDate();
  }
}
