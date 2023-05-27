import crypto from 'crypto';

import { Env } from './env.js';

const algorithm = 'aes-256-cbc';
const key = Buffer.from(Env.DATA_ENCRYPTION_SECRET, 'base64');

export const symmetricEncrypt = (plain: string) => {
  try {
    const iv = crypto.randomBytes(16); // 128-bit IV
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(plain, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return Buffer.concat([iv, Buffer.from(encrypted, 'base64')]);
  } catch (error) {
    // Failed to encrypt
    console.error(error);
  }
  return null;
};

export const symmetricDecrypt = (cipher: Buffer) => {
  try {
    const iv = cipher.subarray(0, 16);
    const encrypted = cipher.subarray(16).toString('base64');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Failed to decrypt
    console.error(error);
  }
  return null;
};
