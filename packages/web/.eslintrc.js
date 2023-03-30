// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../../.eslintrc.json');

module.exports = {
  ...config,
  env: {},
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
};
