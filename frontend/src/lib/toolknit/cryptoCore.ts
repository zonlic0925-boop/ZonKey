import CryptoJS from 'crypto-js';

export const CRYPTO_TOOL_MAX_TEXT = 2 * 1024 * 1024;

export function hashMd5(text: string): string {
  return CryptoJS.MD5(text).toString();
}

export function hashSha1(text: string): string {
  return CryptoJS.SHA1(text).toString();
}

export function hashSha256(text: string): string {
  return CryptoJS.SHA256(text).toString();
}

export function hashSha512(text: string): string {
  return CryptoJS.SHA512(text).toString();
}

export function hmacMd5(text: string, secret: string): string {
  return CryptoJS.HmacMD5(text, secret).toString();
}

export function hmacSha1(text: string, secret: string): string {
  return CryptoJS.HmacSHA1(text, secret).toString();
}

export function hmacSha256(text: string, secret: string): string {
  return CryptoJS.HmacSHA256(text, secret).toString();
}

export function hmacSha512(text: string, secret: string): string {
  return CryptoJS.HmacSHA512(text, secret).toString();
}

export function encryptAes(text: string, secret: string): string {
  return CryptoJS.AES.encrypt(text, secret).toString();
}

export function decryptAes(ciphertext: string, secret: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, secret);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  if (!decrypted && ciphertext) {
    throw new Error('解密失败：秘钥不匹配或密文无效');
  }
  return decrypted;
}

export function generatePassword(length: number = 16, options: { numbers?: boolean; symbols?: boolean; uppercase?: boolean; lowercase?: boolean } = {}): string {
  const chars: string[] = [];
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nums = '0123456789';
  const syms = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (options.lowercase !== false) chars.push(lower);
  if (options.uppercase !== false) chars.push(upper);
  if (options.numbers !== false) chars.push(nums);
  if (options.symbols) chars.push(syms);

  if (chars.length === 0) chars.push(lower + upper + nums);

  const allChars = chars.join('');
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += allChars[array[i] % allChars.length];
  }
  return result;
}
// Aliases for compatibility
export const calcMd5 = hashMd5;
export const calcSha1 = hashSha1;
export const calcSha256 = hashSha256;
export const calcSha512 = hashSha512;



export function encryptAesGcm(plainText: string, key: string, iv?: string): string {
  return encryptAes(plainText, key);
}

export function decryptAesGcm(cipherText: string, key: string, iv?: string): string {
  return decryptAes(cipherText, key);
}

export function encryptAesCbc(plainText: string, key: string, iv?: string): string {
  return CryptoJS.AES.encrypt(plainText, key).toString();
}

export function decryptAesCbc(cipherText: string, key: string, iv?: string): string {
  const bytes = CryptoJS.AES.decrypt(cipherText, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}
