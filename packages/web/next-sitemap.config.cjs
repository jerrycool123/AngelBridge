/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl:
    process.env.NEXTAUTH_URL ??
    (() => {
      throw new Error('Missing NEXTAUTH_URL env var');
    }),
  generateRobotsTxt: true, // (optional)
  exclude: ['/dashboard*'],
  // ...other options
};
