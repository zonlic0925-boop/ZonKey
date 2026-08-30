/* Track B：前端核心逐功能最小验证（node + esbuild 打包）。
   canvas/AudioContext 依赖的工具以纯函数部分 + 构建验证覆盖。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  mergePdfFiles, splitPdfPages, rotatePdfPages, compressPdfFile,
  encryptPdfFile, decryptPdfFile,
} from '../frontend/src/lib/toolknit/pdfCore';
import { extractPptImages, extractPptText, compressPptx } from '../frontend/src/lib/toolknit/pptCore';
import { generatePptOutline, createPptOutlineMarkdown, parsePptOutlineMarkdown } from '../frontend/src/lib/toolknit/pptOutlineCore';
import { buildPptDraftPptx } from '../frontend/src/lib/toolknit/pptDraftCore';
import { calculateBmi, calculateMortgage, calculateLumpSumCompound } from '../frontend/src/lib/toolknit/calcCore';
import { formatJsonText, encodeBase64Utf8, decodeBase64Utf8, encodeUrlComponent, generateUuidV4, decodeJwt } from '../frontend/src/lib/toolknit/developerCore';
import { hashText, hmacText, runSymmetricCipher } from '../frontend/src/lib/toolknit/cryptoCore';
import { generatePassword } from '../frontend/src/lib/toolknit/passwordCore';
import { calculateTextStats } from '../frontend/src/lib/toolknit/textStatsCore';
import { executeTextFormat } from '../frontend/src/lib/toolknit/textFormatCore';
import { extractMarkdownHeadings, applyMarkdownAction } from '../frontend/src/lib/toolknit/markdownCore';
import { audioBufferToWav, analyzeBpmPcm } from '../frontend/src/lib/toolknit/mediaCore';
import { isSupportedImageFileName } from '../frontend/src/lib/toolknit/imageCore';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures');
let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`PASS ${name}`);
  else { failed++; console.log(`FAIL ${name} ${extra}`); }
};

const drawingBytes = new Uint8Array(readFileSync(join(FIX, 'drawing.pdf')));
const documentBytes = new Uint8Array(readFileSync(join(FIX, 'document.pdf')));

// --- PDF 工坊（前端 pdf-lib） ---
const merged = await mergePdfFiles([
  { fileName: 'drawing.pdf', fileData: drawingBytes },
  { fileName: 'document.pdf', fileData: documentBytes },
]);
check('pdf merge 3 pages', merged.length > 1000, `len=${merged.length}`);

const split = await splitPdfPages({
  documents: [{ fileName: 'drawing.pdf', fileData: drawingBytes }],
  pages: [{ fileIndex: 0, pageIndex: 1 }],
});
check('pdf split per page', split.length === 1, `got ${split.length}`);

const rotated = await rotatePdfPages({ fileData: drawingBytes, pages: [{ pageIndex: 1, rotation: 90 }] });
check('pdf rotate', rotated.length > 1000);

const compressed = await compressPdfFile(drawingBytes, 'medium');
check('pdf compress', compressed.length > 500);

const enc = await encryptPdfFile(drawingBytes, 'secret123');
check('pdf encrypt', enc.length > 1000);
const dec = await decryptPdfFile(enc, 'secret123');
check('pdf decrypt roundtrip', dec.length > 1000);

// --- PPT 工坊 ---
const outline = generatePptOutline({ topic: 'ZonScale 测试', deckType: 'auto', slideCount: 4, locale: 'zh' });
check('ppt outline slides', outline.slides.length >= 4, `got ${outline.slides.length}`);
const md = createPptOutlineMarkdown(outline);
const parsed = parsePptOutlineMarkdown(md);
check('ppt outline md roundtrip', parsed.slides.length === outline.slides.length && parsed.title.length > 0);
const draft = await buildPptDraftPptx(parsed);
writeFileSync(join(FIX, 'draft.pptx'), draft.bytes);
check('ppt draft pptx built', draft.bytes.length > 10000 && draft.slideCount >= 4, `size=${draft.bytes.length}`);

const draftFile = new File([draft.bytes], 'draft.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
const texts = await extractPptText(draftFile);
check('ppt text extract', texts.length >= 1, `got ${texts.length}`);
const imgs = await extractPptImages(draftFile);
check('ppt image extract (empty ok)', Array.isArray(imgs) && imgs.length === 0, `got ${imgs.length}`);
const packed = await compressPptx(draftFile);
check('ppt compress repack', packed.blob.size > 5000 && packed.compressedSize <= packed.originalSize + 1024, `${packed.originalSize} -> ${packed.compressedSize}`);

// --- 计算工坊 ---
const bmi = calculateBmi(175, 70);
check('bmi calc', Math.abs(bmi.bmi - 22.86) < 0.1, JSON.stringify(bmi));
const mortgage = calculateMortgage(1000000, 4.2, 30);
check('mortgage monthly payment', mortgage.firstMonthPayment > 4000 && mortgage.firstMonthPayment < 5000, String(mortgage.firstMonthPayment));
const lump = calculateLumpSumCompound(10000, 5, 2, 1);
check('interest compound', Math.abs(lump.finalAmount - 11025) < 1, JSON.stringify(lump));

// --- 密码生成 ---
const pwd = generatePassword({ length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true });
check('password gen 20 chars', typeof pwd === 'string' ? pwd.length === 20 : (pwd.password?.length === 20), JSON.stringify(pwd).slice(0, 60));

// --- 开发者工具 ---
check('json format', formatJsonText('{"a":1}') === '{\n  "a": 1\n}' || formatJsonText('{"a":1}').includes('"a": 1'));
check('base64 utf8 roundtrip', decodeBase64Utf8(encodeBase64Utf8('中文abc')) === '中文abc');
check('url encode', encodeUrlComponent('a b&c') === 'a%20b%26c');
check('uuid v4', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(generateUuidV4()));
const jwt = decodeJwt('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig');
check('jwt decode', jwt.payload.sub === '123', JSON.stringify(jwt.payload));

// --- Hash & Crypto ---
const sha256 = hashText('sha256', 'abc');
check('sha256 abc', sha256 === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', String(sha256).slice(0, 20));
const hmac = hmacText('hmac-sha256', 'data', 'key');
check('hmac-sha256', typeof hmac === 'string' && hmac.length >= 64, String(hmac).slice(0, 20));
try {
  const keyHex = '00112233445566778899aabbccddeeff';
  const ivHex = '0102030405060708090a0b0c0d0e0f10';
  const aes = runSymmetricCipher('aes', { operation: 'encrypt', input: 'secret', key: keyHex, iv: ivHex });
  const back = runSymmetricCipher('aes', { operation: 'decrypt', input: aes, key: keyHex, iv: ivHex, inputFormat: 'base64' });
  check('aes roundtrip', back.includes('secret'), JSON.stringify({ aes: String(aes).slice(0, 20), back: String(back).slice(0, 40) }));
} catch (e) {
  check('aes roundtrip', false, String(e));
}

// --- 文本工坊 ---
const stats = calculateTextStats('Hello 世界\n第二行 text');
check('text stats', stats.chars > 0 && stats.chineseChars === 5, JSON.stringify(stats).slice(0, 120));
check('text format uppercase', executeTextFormat('uppercase', 'abc def') === 'ABC DEF');
const heads = extractMarkdownHeadings('# T1\n## T2\ntext');
check('markdown headings', heads.length === 2, JSON.stringify(heads));
const bolded = applyMarkdownAction('hello world', 0, 5, 'bold');
check('markdown bold action', bolded.text.includes('**hello**'), JSON.stringify(bolded));

// --- 音频（纯数学部分） ---
const fakeBuffer = {
  sampleRate: 44100, length: 44100, duration: 1,
  getChannelData: () => new Float32Array(44100).fill(0.5),
  numberOfChannels: 1,
};
const wav = audioBufferToWav(fakeBuffer);
check('wav encoder', wav instanceof Blob && wav.size > 44100 * 2, `size=${wav.size}`);

// 120 BPM 脉冲序列：每 0.5s 一个 click
const SR = 44100;
const dur = 6;
const pcm = new Float32Array(SR * dur);
for (let beat = 0; beat < dur * 2; beat++) {
  const start = Math.floor(beat * 0.5 * SR);
  for (let i = 0; i < 800 && start + i < pcm.length; i++) {
    pcm[start + i] = Math.sin(2 * Math.PI * 1000 * i / SR) * Math.exp(-i / 200);
  }
}
const bpmResult = analyzeBpmPcm(pcm, SR);
check('bpm detect ~120', Math.abs(bpmResult.bpm - 120) <= 6, JSON.stringify(bpmResult).slice(0, 80));

// --- 图像工具（canvas 部分以纯函数 + 构建验证） ---
check('image ext validation', isSupportedImageFileName('a.png') && !isSupportedImageFileName('a.exe'));

console.log(failed === 0 ? 'TRACK B: ALL PASS' : `TRACK B: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
