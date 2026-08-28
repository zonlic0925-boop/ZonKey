/**
 * 哈希与加密套件核心 — 按 ToolKnit crypto-tool-core.js 移植（17 种算法）。
 * 哈希: MD5 / SHA-1 / SHA-224 / SHA-256 / SHA-384 / SHA-512 / SHA3-256 / SHA3-512 / SM3
 * HMAC: HMAC-MD5 / HMAC-SHA1 / HMAC-SHA256 / HMAC-SHA512
 * 对称: AES / DES / 3DES / RC4 / SM4（字节级密钥，支持模式与填充）
 * 非对称: RSA-OAEP (WebCrypto)
 */
import CryptoJS from 'crypto-js';
import smCrypto from 'sm-crypto';

export type KeyFormat = 'text' | 'hex' | 'base64';
export type OutputFormat = 'text' | 'hex' | 'base64';
export type CipherMode = 'CBC' | 'ECB' | 'CFB' | 'OFB' | 'CTR';
export type CipherPadding = 'pkcs7' | 'ansix923' | 'iso10126' | 'zero' | 'nopadding';

export const CRYPTO_MAX_TEXT_CHARS = 2 * 1024 * 1024;

export const HASH_ALGORITHMS = [
  'md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512',
  'sha3-256', 'sha3-512', 'sm3',
] as const;
export const HMAC_ALGORITHMS = ['hmac-md5', 'hmac-sha1', 'hmac-sha256', 'hmac-sha512'] as const;
export const SYMMETRIC_ALGORITHMS = ['aes', 'des', '3des', 'rc4', 'sm4'] as const;
/** 17 种算法 = 9 哈希 + 4 HMAC + 5 对称 + RSA */
export const ALL_ALGORITHMS = [...HASH_ALGORITHMS, ...HMAC_ALGORITHMS, ...SYMMETRIC_ALGORITHMS, 'rsa'] as const;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function assertCryptoText(value: unknown): string {
  const text = String(value ?? '');
  if (text.length > CRYPTO_MAX_TEXT_CHARS) throw new Error('crypto:input-too-large');
  return text;
}

export function bytesToHex(bytes: Uint8Array, upper = false): string {
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return upper ? value.toUpperCase() : value;
}

export function hexToBytes(value: string): Uint8Array {
  const text = String(value || '').replace(/\s+/g, '');
  if (!text || text.length % 2 || !/^[\da-f]+$/i.test(text)) throw new Error('crypto:invalid-hex');
  return Uint8Array.from(text.match(/../g)!, (part) => Number.parseInt(part, 16));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  try {
    const binary = atob(String(value || '').replace(/\s+/g, ''));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    throw new Error('crypto:invalid-base64');
  }
}

export function parseBytes(value: string, format: KeyFormat = 'text'): Uint8Array {
  if (format === 'hex') return hexToBytes(value);
  if (format === 'base64') return base64ToBytes(value);
  return encoder.encode(String(value ?? ''));
}

export function formatBytes(bytes: Uint8Array, format: OutputFormat = 'hex', upper = false): string {
  if (format === 'base64') return bytesToBase64(bytes);
  if (format === 'text') {
    try {
      return decoder.decode(bytes);
    } catch {
      throw new Error('crypto:invalid-utf8-output');
    }
  }
  return bytesToHex(bytes, upper);
}

function requireByteLength(bytes: Uint8Array, expected: number[] | number, label = 'key'): Uint8Array {
  const accepted = Array.isArray(expected) ? expected : [expected];
  if (!accepted.includes(bytes.length)) throw new Error(`crypto:${label}-length:${accepted.join('|')}`);
  return bytes;
}

function bytesToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    words[i >>> 2] = (words[i >>> 2] || 0) | (bytes[i] << (24 - (i % 4) * 8));
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

function wordArrayToBytes(wordArray: CryptoJS.lib.WordArray): Uint8Array {
  const { words, sigBytes } = wordArray;
  return Uint8Array.from({ length: sigBytes }, (_, i) => (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff);
}

function cryptoJsMode(value: string | undefined): typeof CryptoJS.mode.CBC {
  const key = String(value || 'CBC').toUpperCase();
  const mode = (CryptoJS.mode as unknown as Record<string, typeof CryptoJS.mode.CBC>)[key];
  if (!mode) throw new Error('crypto:invalid-mode');
  return mode;
}

function cryptoJsPadding(value: string | undefined): typeof CryptoJS.pad.Pkcs7 {
  const names: Record<string, string> = {
    pkcs7: 'Pkcs7',
    zero: 'ZeroPadding',
    nopadding: 'NoPadding',
    ansix923: 'AnsiX923',
    iso10126: 'Iso10126',
  };
  const key = names[String(value || 'pkcs7').toLowerCase()];
  const pad = (CryptoJS.pad as unknown as Record<string, typeof CryptoJS.pad.Pkcs7>)[key ?? ''];
  if (!pad) throw new Error('crypto:invalid-padding');
  return pad;
}

const SHA3_SIZES: Record<string, number> = { 'sha3-256': 256, 'sha3-512': 512 };

export function hashText(
  algorithm: string,
  input: string,
  { upper = false }: { upper?: boolean } = {},
): string {
  const id = String(algorithm).toLowerCase();
  let output: string;
  if (id === 'sm3') output = smCrypto.sm3(String(input ?? ''));
  else if (id === 'md5') output = CryptoJS.MD5(String(input ?? '')).toString();
  else if (id === 'sha1') output = CryptoJS.SHA1(String(input ?? '')).toString();
  else if (id === 'sha224') output = CryptoJS.SHA224(String(input ?? '')).toString();
  else if (id === 'sha256') output = CryptoJS.SHA256(String(input ?? '')).toString();
  else if (id === 'sha384') output = CryptoJS.SHA384(String(input ?? '')).toString();
  else if (id === 'sha512') output = CryptoJS.SHA512(String(input ?? '')).toString();
  else if (SHA3_SIZES[id]) output = CryptoJS.SHA3(String(input ?? ''), { outputLength: SHA3_SIZES[id] }).toString();
  else throw new Error('crypto:unsupported-algorithm');
  return upper ? output.toUpperCase() : output.toLowerCase();
}

export function hmacText(
  algorithm: string,
  input: string,
  key: string,
  keyFormat: KeyFormat = 'text',
  upper = false,
): string {
  const id = String(algorithm).toLowerCase();
  const keyWordArray = bytesToWordArray(parseBytes(key, keyFormat));
  const message = String(input ?? '');
  let output: string;
  if (id === 'hmac-md5') output = CryptoJS.HmacMD5(message, keyWordArray).toString();
  else if (id === 'hmac-sha1') output = CryptoJS.HmacSHA1(message, keyWordArray).toString();
  else if (id === 'hmac-sha256') output = CryptoJS.HmacSHA256(message, keyWordArray).toString();
  else if (id === 'hmac-sha512') output = CryptoJS.HmacSHA512(message, keyWordArray).toString();
  else throw new Error('crypto:unsupported-algorithm');
  return upper ? output.toUpperCase() : output;
}

export interface CipherOptions {
  operation: 'encrypt' | 'decrypt';
  input: string;
  key: string;
  keyFormat?: KeyFormat;
  iv?: string;
  ivFormat?: KeyFormat;
  mode?: CipherMode;
  padding?: CipherPadding;
  inputFormat?: KeyFormat;
  outputFormat?: OutputFormat;
  upper?: boolean;
}

const KEY_LENGTHS: Record<string, number[] | null> = {
  aes: [16, 24, 32],
  des: [8],
  '3des': [24],
  rc4: null,
  sm4: [16],
};

function runCryptoJsCipher(algorithm: string, options: CipherOptions): string {
  const operation = options.operation;
  const keyBytes = parseBytes(options.key, options.keyFormat || 'hex');
  const spec = KEY_LENGTHS[algorithm];
  if (spec) requireByteLength(keyBytes, spec, 'key');
  if (!keyBytes.length) throw new Error('crypto:key-required');

  const modeName = String(options.mode || 'CBC').toUpperCase();
  const config: Record<string, unknown> = {};
  if (algorithm !== 'rc4') {
    config.mode = cryptoJsMode(modeName);
    config.padding = cryptoJsPadding(options.padding);
    if (modeName !== 'ECB') {
      const ivBytes = parseBytes(options.iv ?? '', options.ivFormat || 'hex');
      requireByteLength(ivBytes, algorithm === 'aes' ? 16 : 8, 'iv');
      config.iv = bytesToWordArray(ivBytes);
    }
  }

  const cipher =
    algorithm === 'aes' ? CryptoJS.AES
    : algorithm === 'des' ? CryptoJS.DES
    : algorithm === '3des' ? CryptoJS.TripleDES
    : CryptoJS.RC4;
  const key = bytesToWordArray(keyBytes);
  const inputBytes = parseBytes(options.input, options.inputFormat || (operation === 'encrypt' ? 'text' : 'base64'));
  const blockSize = algorithm === 'aes' ? 16 : algorithm === 'rc4' ? 1 : 8;
  const paddingName = String(options.padding || 'pkcs7').toLowerCase();
  if (
    algorithm !== 'rc4' && ['CBC', 'ECB'].includes(modeName) &&
    (operation === 'decrypt' || paddingName === 'nopadding') &&
    inputBytes.length % blockSize !== 0
  ) {
    throw new Error('crypto:block-length');
  }

  if (operation === 'encrypt') {
    const encrypted = cipher.encrypt(bytesToWordArray(inputBytes), key, config as never);
    return formatBytes(wordArrayToBytes(encrypted.ciphertext), options.outputFormat || 'base64', options.upper);
  }
  const ciphertext = bytesToWordArray(inputBytes);
  const decrypted = cipher.decrypt({ ciphertext } as never, key, config as never);
  return formatBytes(wordArrayToBytes(decrypted), options.outputFormat || 'text', options.upper);
}

function runSm4(options: CipherOptions): string {
  requireByteLength(parseBytes(options.key, options.keyFormat || 'hex'), 16, 'key');
  const key = Array.from(parseBytes(options.key, options.keyFormat || 'hex'));
  const mode = String(options.mode || 'cbc').toLowerCase();
  const padding = String(options.padding || 'pkcs7').toLowerCase();
  if (!['cbc', 'ecb'].includes(mode)) throw new Error('crypto:invalid-mode');
  if (!['pkcs7', 'nopadding'].includes(padding)) throw new Error('crypto:invalid-padding');
  const inputBytes = parseBytes(options.input, options.inputFormat || (options.operation === 'encrypt' ? 'text' : 'base64'));
  if (options.operation === 'decrypt' && inputBytes.length % 16 !== 0) throw new Error('crypto:block-length');
  const settings: Record<string, unknown> = { mode, padding: padding === 'nopadding' ? 'none' : 'pkcs#7', output: 'array' };
  if (mode !== 'ecb') {
    const iv = parseBytes(options.iv ?? '', options.ivFormat || 'hex');
    requireByteLength(iv, 16, 'iv');
    settings.iv = Array.from(iv);
  }
  const data = Array.from(inputBytes);
  const result =
    options.operation === 'encrypt'
      ? smCrypto.sm4.encrypt(data, key, settings)
      : smCrypto.sm4.decrypt(data, key, settings);
  return formatBytes(Uint8Array.from(result as number[]), options.outputFormat || (options.operation === 'encrypt' ? 'base64' : 'text'), options.upper);
}

export function runSymmetricCipher(algorithm: string, options: CipherOptions): string {
  const id = String(algorithm).toLowerCase();
  if (id === 'sm4') return runSm4(options);
  if (['aes', 'des', '3des', 'rc4'].includes(id)) return runCryptoJsCipher(id, options);
  throw new Error('crypto:unsupported-algorithm');
}

// ===== RSA（WebCrypto, RSA-OAEP / SHA-256） =====

function pemToDer(pem: string, label: string): ArrayBuffer {
  const text = assertCryptoText(pem).trim();
  const begin = `-----BEGIN ${label}-----`;
  const end = `-----END ${label}-----`;
  if (!text.startsWith(begin) || !text.endsWith(end)) throw new Error('crypto:invalid-pem');
  const body = text.slice(begin.length, text.length - end.length).trim();
  if (!body || !/^[A-Za-z0-9+/=\s]+$/.test(body)) throw new Error('crypto:invalid-pem');
  const bytes = base64ToBytes(body);
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function derToPem(der: Uint8Array, label: string): string {
  const base64 = bytesToBase64(der);
  return `-----BEGIN ${label}-----\n${base64.match(/.{1,64}/g)!.join('\n')}\n-----END ${label}-----`;
}

export const RSA_KEY_SIZES = [1024, 2048, 4096] as const;

export async function generateRsaKeyPair(size: number = 2048): Promise<{ publicKey: string; privateKey: string }> {
  const bits = Number(size);
  if (!RSA_KEY_SIZES.includes(bits as (typeof RSA_KEY_SIZES)[number])) throw new Error('crypto:rsa-size');
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  );
  return {
    publicKey: derToPem(new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)), 'PUBLIC KEY'),
    privateKey: derToPem(new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey)), 'PRIVATE KEY'),
  };
}

export async function runRsa(
  operation: 'encrypt' | 'decrypt',
  input: string,
  publicKey: string,
  privateKey: string,
): Promise<string> {
  assertCryptoText(input);
  if (operation === 'encrypt') {
    const key = await crypto.subtle.importKey(
      'spki', pemToDer(publicKey, 'PUBLIC KEY'),
      { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'],
    );
    return bytesToBase64(new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, encoder.encode(String(input)))));
  }
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToDer(privateKey, 'PRIVATE KEY'),
    { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt'],
  );
  const cipherBytes = base64ToBytes(input);
  const cipherBuffer = new ArrayBuffer(cipherBytes.length);
  new Uint8Array(cipherBuffer).set(cipherBytes);
  return decoder.decode(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key, cipherBuffer));
}
