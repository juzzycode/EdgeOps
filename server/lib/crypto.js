import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

const deriveKey = (secret) => crypto.createHash('sha256').update(secret).digest();

export const encryptSecret = (value, secret) => {
  if (!value) return '';

  if (!secret) {
    return `plain:${Buffer.from(value, 'utf8').toString('base64')}`;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ['enc', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
};

export const decryptSecret = (storedValue, secret) => {
  if (!storedValue) return '';

  if (storedValue.startsWith('plain:')) {
    return Buffer.from(storedValue.slice(6), 'base64').toString('utf8');
  }

  const [, ivText, tagText, encryptedText] = storedValue.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(secret), Buffer.from(ivText, 'base64'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};
