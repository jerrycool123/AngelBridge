import { CronJob } from 'cron';

import checkOAuthMembershipJob from './oauth-membership.js';
import checkOCRMembershipJob from './ocr-membership.js';

const checkOAuthMembershipRoutine: CustomCronJob = {
  name: 'OAuthMembershipCheckRoutine',
  cronjob: new CronJob('0 0 * * *', checkOAuthMembershipJob),
};

const checkOCRMembershipRoutine: CustomCronJob = {
  name: 'OCR Membership Check',
  cronjob: new CronJob('0 12 * * *', checkOCRMembershipJob),
};

const cronJobs: CustomCronJob[] = [checkOCRMembershipRoutine, checkOAuthMembershipRoutine];

export default cronJobs;
