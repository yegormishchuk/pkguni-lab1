import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getConversion, invert3, mulMatMat, rgbToXyz, xyzToRgb, xyzToLab, labToXyz,
  rgbToCmyk, cmykToRgb, mapToGamut, toHex, fromHex,
} from '../js/model/colorMath.js';

const near = (actual, expected, tol, msg = '') => {
  assert.equal(actual.length, expected.length, msg);
  actual.forEach((v, i) =>
    assert.ok(Math.abs(v - expected[i]) <= tol, `${msg} [${i}]: ${v} ≠ ${expected[i]} (±${tol})`));
};

test('RGB(255, 0, 0) → XYZ и LAB под D65', () => {
  const xyz = rgbToXyz([255, 0, 0], 'D65');
  near(xyz, [0.4124, 0.2126, 0.0193], 1e-3, 'XYZ');
  near(xyzToLab(xyz, 'D65'), [53.24, 80.09, 67.20], 0.01, 'LAB');
});

test('RGB(255, 0, 0) → LAB под D50 (Брэдфорд)', () => {
  near(xyzToLab(rgbToXyz([255, 0, 0], 'D50'), 'D50'), [54.29, 80.80, 69.89], 0.02);
});

test('Зелёный и синий под D65', () => {
  near(xyzToLab(rgbToXyz([0, 255, 0])), [87.73, -86.18, 83.18], 0.02, 'зелёный');
  near(xyzToLab(rgbToXyz([0, 0, 255])), [32.30, 79.19, -107.86], 0.02, 'синий');
});

test('RGB(255, 0, 0) → CMYK(0, 100, 100, 0) в обоих режимах', () => {
  near(rgbToCmyk([255, 0, 0], 'GCR'), [0, 100, 100, 0], 1e-9, 'GCR');
  near(rgbToCmyk([255, 0, 0], 'UCR'), [0, 100, 100, 0], 1e-9, 'UCR');
});

test('Белый и чёрный', () => {
  for (const il of ['D65', 'D50', 'E']) {
    near(xyzToLab(rgbToXyz([255, 255, 255], il), il), [100, 0, 0], 1e-6, `белый ${il}`);
    near(xyzToLab(rgbToXyz([0, 0, 0], il), il), [0, 0, 0], 1e-9, `чёрный ${il}`);
  }
  near(rgbToCmyk([0, 0, 0], 'GCR'), [0, 0, 0, 100], 1e-9);
  near(rgbToCmyk([0, 0, 0], 'UCR'), [0, 0, 0, 100], 1e-9);
  near(rgbToCmyk([255, 255, 255], 'GCR'), [0, 0, 0, 0], 1e-9);
});

test('Матрицы строятся на лету: белый RGB даёт белую точку источника', () => {
  const whites = { D65: [0.95046, 1, 1.08906], D50: [0.96430, 1, 0.82510], E: [1, 1, 1] };
  for (const [il, expected] of Object.entries(whites)) {
    const { white, rgbToXyz: M } = getConversion(il);
    near(white, expected, 1e-4, `белая точка ${il}`);
    near(M.map(r => r[0] + r[1] + r[2]), white, 1e-9, `сумма строк ${il}`);
  }
  assert.notDeepEqual(getConversion('D65').rgbToXyz, getConversion('D50').rgbToXyz);
});

test('Матрица D65 совпадает со стандартной матрицей sRGB', () => {
  near(getConversion('D65').rgbToXyz.flat(),
    [0.4124, 0.3576, 0.1805, 0.2126, 0.7152, 0.0722, 0.0193, 0.1192, 0.9505], 1e-4);
});

test('Обращение матрицы', () => {
  const M = getConversion('D50').rgbToXyz;
  near(mulMatMat(M, invert3(M)).flat(), [1, 0, 0, 0, 1, 0, 0, 0, 1], 1e-12);
});

test('Обратимость RGB → XYZ → LAB → XYZ → RGB под каждым источником', () => {
  for (const il of ['D65', 'D50', 'E']) {
    for (const rgb of [[255, 0, 0], [12, 200, 99], [3, 3, 3], [128, 128, 128], [250, 240, 10]]) {
      const back = xyzToRgb(labToXyz(xyzToLab(rgbToXyz(rgb, il), il), il), il);
      assert.equal(back.outOfGamut, false);
      near(back.rgb, rgb, 1e-6, `${il} ${rgb}`);
    }
  }
});

test('GCR: серая компонента полностью заменяется чёрным', () => {
  near(rgbToCmyk([128, 128, 128], 'GCR'), [0, 0, 0, 49.8039], 1e-3);
  near(rgbToCmyk([100, 50, 25], 'GCR'), [0, 50, 75, 60.7843], 1e-3);
});

test('UCR: в светлых тонах чёрного нет, в глубоких тенях появляется', () => {
  near(rgbToCmyk([128, 128, 128], 'UCR'), [49.8039, 49.8039, 49.8039, 0], 1e-3, 'светлый');
  near(rgbToCmyk([51, 51, 51], 'UCR'), [61.5385, 61.5385, 61.5385, 48], 1e-3, 'тень');
  const shadow = rgbToCmyk([51, 51, 51], 'GCR');
  assert.ok(rgbToCmyk([51, 51, 51], 'UCR')[3] < shadow[3], 'UCR добавляет меньше чёрного, чем GCR');
});

test('CMYK → RGB обратим для обоих алгоритмов', () => {
  for (const mode of ['GCR', 'UCR']) {
    for (const rgb of [[255, 0, 0], [100, 50, 25], [20, 30, 10], [0, 0, 0], [255, 255, 255]]) {
      near(cmykToRgb(rgbToCmyk(rgb, mode)), rgb, 1e-9, `${mode} ${rgb}`);
    }
  }
});

test('Clipping: значения прижимаются к границам', () => {
  const { rgb, outOfGamut } = mapToGamut([1.5, 0.5, -0.2], 'clip');
  assert.equal(outOfGamut, true);
  assert.equal(rgb[0], 1);
  assert.equal(rgb[2], 0);
});

test('Scaling: диапазон сжимается пропорционально', () => {
  const linear = [1.5, 0.5, -0.5];
  const { rgb, outOfGamut } = mapToGamut(linear, 'scale');
  assert.equal(outOfGamut, true);
  near(rgb, [1, 0.5, 0].map(v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)), 1e-12);
});

test('Цвет вне охвата: LAB(50, 100, −100) по-разному обрабатывается стратегиями', () => {
  const xyz = labToXyz([50, 100, -100]);
  const clip = xyzToRgb(xyz, 'D65', 'clip');
  const scale = xyzToRgb(xyz, 'D65', 'scale');
  assert.equal(clip.outOfGamut, true);
  assert.equal(scale.outOfGamut, true);
  near(clip.rgb.map(Math.round), [180, 0, 255], 0);
  assert.ok(scale.rgb.every(c => c >= 0 && c <= 255));
  assert.notDeepEqual(clip.rgb, scale.rgb);
});

test('Цвет в охвате не помечается как вышедший', () => {
  assert.equal(xyzToRgb(labToXyz([100, 0, 0])).outOfGamut, false);
});

test('HEX', () => {
  assert.equal(toHex([255, 0, 128]), '#FF0080');
  assert.deepEqual(fromHex('#ff0080'), [255, 0, 128]);
  assert.throws(() => fromHex('zzz'));
});
