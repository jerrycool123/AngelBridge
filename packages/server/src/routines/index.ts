import OCRMembershipCheckRoutine from './ocr-membership.js';

const cronJobs: CustomCronJob[] = [OCRMembershipCheckRoutine];

const startCronjobs = () => {
  for (const job of cronJobs) {
    console.log(`Starting cron job: ${job.name}`);
    job.cronjob.start();
  }
};

export default startCronjobs;
