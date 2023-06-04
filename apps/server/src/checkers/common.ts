import dayjs from 'dayjs';

import { BadRequestError } from '../utils/error.js';

namespace CommonChecker {
  export const requireGivenDateNotTooFarInFuture = (
    targetDate: dayjs.Dayjs | null,
    baseDate = dayjs(),
    limitDays = 60,
  ) => {
    const reasonableTimeLimit = baseDate.add(limitDays, 'days');

    if (targetDate === null) {
      throw new BadRequestError(
        'The target date is invalid.\n' + 'Please set the correct date manually.',
      );
    } else if (targetDate.isAfter(reasonableTimeLimit)) {
      throw new BadRequestError(
        'The target date is too far in the future.\n' +
          `The target date (\`${targetDate.format(
            'YYYY/MM/DD',
          )}\`) must not be more than ${limitDays} days after the base date (\`${baseDate.format(
            'YYYY/MM/DD',
          )}\`).`,
      );
    }
    return targetDate;
  };
}

export default CommonChecker;
