import cronJobs from './jobs/index.js';

const startCronjobs = () => {
  for (const job of cronJobs) {
    console.log(`Starting cron job: ${job.name}`);
    job.cronjob.start();
  }
};

export default startCronjobs;
