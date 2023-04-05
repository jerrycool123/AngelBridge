import config from '../../.eslintrc.json';

const newConfig = {
  ...config,
  env: {},
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
};

export default newConfig;
