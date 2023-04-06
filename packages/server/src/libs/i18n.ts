export const extractDate = (text: string, languageCode: string) => {
  // replace spaces with empty string
  const lines = text.split('\n').map((line) => line.replace(/\s/g, ''));

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  if (languageCode === 'eng') {
    const regex =
      /Nextbillingdate:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{1,2}),(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
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
        month = monthMap[abbreviatedMonth];
        [day, year] = match.slice(2, 4).map((s) => parseInt(s, 10));
        break;
      }
    }
  } else if (languageCode === 'chi_tra') {
    const regex = /帳單日期:(\d{4})年(\d{1,2})月(\d{1,2})日/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        [year, month, day] = match.slice(1, 4).map((s) => parseInt(s, 10));
        break;
      }
    }
  } else if (languageCode === 'chi_sim') {
    const regex = /结算日期:(\d{4})年(\d{1,2})月(\d{1,2})日/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        [year, month, day] = match.slice(1, 4).map((s) => parseInt(s, 10));
        break;
      }
    }
  } else if (languageCode === 'deu') {
    const regex = /NächstesAbrechnungsdatum:(\d{1,2})\.(\d{1,2})\.(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        [day, month, year] = match.slice(1, 4).map((s) => parseInt(s, 10));
        break;
      }
    }
  } else if (languageCode === 'fil') {
    const regex =
      /Susunodnapetsangpagsingil:(Ene|Peb|Mar|Abr|Mayo|Hun|Hul|Ago|Set|Okt|Nob|Dis)(\d{1,2}),(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
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
        month = monthMap[abbreviatedMonth];
        [day, year] = match.slice(2, 4).map((s) => parseInt(s, 10));
        break;
      }
    }
  } else if (languageCode === 'ind') {
    const regex =
      /Tanggalpenagihanberikutnya:(\d{1,2})(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
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
        month = monthMap[abbreviatedMonth];
        [day, , year] = match.slice(1, 4).map((s) => parseInt(s, 10));
        break;
      }
    }
  } else if (languageCode === 'jpn') {
    const regex = /次回請求日:(\d{4})\/(\d{2})\/(\d{2})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        [year, month, day] = match.slice(1, 4).map((s) => parseInt(s, 10));
        break;
      }
    }
  } else if (languageCode === 'kor') {
    const regex = /다음결제일:(\d{4})\.(\d{1,2})\.(\d{1,2})\./;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        [year, month, day] = match.slice(1, 4).map((s) => parseInt(s, 10));
        break;
      }
    }
  } else if (languageCode === 'msa') {
    const regex =
      /Tarikhpengebilanseterusnya:(\d{1,2})(Jan|Feb|Mac|Apr|Mei|Jun|Jul|Ogos|Sep|Okt|Nov|Dis)(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
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
        month = monthMap[abbreviatedMonth];
        [day, , year] = match.slice(1, 4).map((s) => parseInt(s, 10));
        break;
      }
    }
  } else if (languageCode === 'tha') {
    const regex =
      /เรียกเก็บเงินครั้งถัดไปในวันที่(\d{1,2})(ม.ค.|ก.พ.|มี.ค.|เม.ย.|พ.ค.|มิ.ย.|ก.ค.|ส.ค.|ก.ย.|ต.ค.|พ.ย.|ธ.ค.)(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
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
        month = monthMap[abbreviatedMonth];
        [day, , year] = match.slice(1, 4).map((s) => parseInt(s, 10));
        break;
      }
    }
  } else if (languageCode === 'vie') {
    const regex = /Ngàythanhtoántiếptheo:(\d{1,2})thg(\d{1,2}),(\d{4})/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        [day, month, year] = match.slice(1, 4).map((s) => parseInt(s, 10));
        break;
      }
    }
  } else {
    throw new Error('Not implemented error');
  }
  return { day, month, year };
};
