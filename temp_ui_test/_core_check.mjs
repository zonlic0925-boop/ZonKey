/* 前端核心最小验证脚本：colorSpaceCore + typingCore（esbuild 打包后 node 运行） */
import {
  rgbToOklab, oklabToRgb, rgbToHex, rgbToAllSpaces, oklabInSrgbGamut,
  oklabInRec2020, spaceToDisplayRgb, normalizeSpaceValues,
} from '../frontend/src/lib/zonkey/colorSpaceCore';
import {
  generateTypingText, computeTypingStats, getTypingRating, normalizeTypingValue,
} from '../frontend/src/lib/zonkey/typingCore';

let failed = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`PASS ${name}`);
  else { failed++; console.log(`FAIL ${name} ${extra}`); }
}

// --- 色域对比核心 ---
const ok = rgbToOklab(255, 0, 0);
check('red oklab L≈0.628', Math.abs(ok.L - 0.6279) < 0.005, `L=${ok.L}`);
check('red oklab C≈0.257', Math.abs(ok.a - 0.2248) < 0.01 && Math.abs(ok.b - 0.1258) < 0.01, JSON.stringify(ok));
const back = oklabToRgb(ok.L, ok.a, ok.b);
check('oklab roundtrip red', Math.abs(back.r - 255) < 1 && Math.abs(back.g) < 1 && Math.abs(back.b) < 1, JSON.stringify(back));
const all = rgbToAllSpaces(30, 144, 255);
check('hsl of dodgerblue ≈ 210°', Math.abs(all.hsl.h - 209.999) < 0.6, `h=${all.hsl.h}`);
check('cmyk of white k=0', rgbToAllSpaces(255, 255, 255).cmyk.k < 0.01);
check('hex uppercase', rgbToHex(30, 144, 255) === '#1E90FF', rgbToHex(30, 144, 255));
check('red in sRGB gamut', oklabInSrgbGamut(ok.L, ok.a, ok.b));
check('red in rec2020 gamut', oklabInRec2020(ok.L, ok.a, ok.b));
// P3 绿 (0, 0.98, 0.2 in P3) 近似 oklab(0.87, -0.2, 0.13) → 超出 sRGB
const p3green = { L: 0.8669, a: -0.2160, b: 0.1304 };
check('p3 green out of sRGB', !oklabInSrgbGamut(p3green.L, p3green.a, p3green.b));
check('hsl roundtrip', (() => {
  const r = spaceToDisplayRgb('hsl', { h: 210, s: 100, l: 50 });
  return Math.abs(r.r - 0) < 1 && Math.abs(r.g - 128) < 1 && Math.abs(r.b - 255) < 1;
})());
check('normalize clamps', normalizeSpaceValues('rgb', { r: 300, g: -5, b: 12.3 }).r === 255
  && normalizeSpaceValues('rgb', { r: 300, g: -5, b: 12.3 }).g === 0);

// --- 打字测试核心 ---
const text = generateTypingText('zh', 'master');
check('zh master 12 segments', text.trim().split(/\s+/).length === 12, text.slice(0, 30));
const textEn = generateTypingText('en', 'easy');
check('en easy 24 segments', textEn.trim().split(/\s+/).length === 24);
check('normalize strips punctuation', normalizeTypingValue('你好，世界！ hello, world!') === '你好世界helloworld');
const stats = computeTypingStats('abcdef', 'abcdef', 1);
check('stats all correct', stats.correct === 6 && stats.wrong === 0 && stats.wpm === Math.round(6 / 5) && stats.accuracy === 100, JSON.stringify(stats));
const stats2 = computeTypingStats('abc', 'axc', 0.5);
check('stats partial', stats2.correct === 2 && stats2.wrong === 1 && stats2.accuracy === 67, JSON.stringify(stats2));
check('rating zh S/A/D', getTypingRating(130, 'zh') === 'S' && getTypingRating(110, 'zh') === 'A' && getTypingRating(10, 'zh') === 'D');
check('rating en thresholds', getTypingRating(90, 'en') === 'S' && getTypingRating(50, 'en') === 'B' && getTypingRating(5, 'en') === 'D');

console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
