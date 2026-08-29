import { createHash } from 'node:crypto';

export const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export const deterministicUuid = (namespace: string, key: string): string => {
  const characters = sha256(`${namespace}\u0000${key}`).slice(0, 32).split('');

  characters[12] = '4';
  characters[16] = '8';

  const hex = characters.join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
};
