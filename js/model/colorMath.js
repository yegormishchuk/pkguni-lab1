export const ILLUMINANTS = {
  D65: { title: 'D65 — средний дневной свет (sRGB)', xy: [0.3127, 0.3290] },
  D50: { title: 'D50 — тёплый дневной свет (полиграфия)', xy: [0.3457, 0.3585] },
  E: { title: 'E — равноэнергетический источник', xy: [1 / 3, 1 / 3] },
};

export const SRGB_SPACE = {
  primaries: { r: [0.64, 0.33], g: [0.30, 0.60], b: [0.15, 0.06] },
  white: 'D65',
};

const BRADFORD = [
  [0.8951, 0.2664, -0.1614],
  [-0.7502, 1.7135, 0.0367],
  [0.0389, -0.0685, 1.0296],
];

const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

export function invert3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) throw new Error('Матрица вырождена');
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}

export const mulMatVec = (m, v) => m.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

export const mulMatMat = (a, b) =>
  a.map(row => [0, 1, 2].map(j => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));

const diag = v => [[v[0], 0, 0], [0, v[1], 0], [0, 0, v[2]]];

export const xyToXyz = ([x, y]) => [x / y, 1, (1 - x - y) / y];

export const whitePoint = illuminant => xyToXyz(ILLUMINANTS[illuminant].xy);

export function rgbToXyzMatrix(primaries, whiteXyz) {
  const P = [primaries.r, primaries.g, primaries.b].map(xyToXyz);
  const columns = [[P[0][0], P[1][0], P[2][0]], [P[0][1], P[1][1], P[2][1]], [P[0][2], P[1][2], P[2][2]]];
  const S = mulMatVec(invert3(columns), whiteXyz);
  return mulMatMat(columns, diag(S));
}

export function bradfordMatrix(srcWhite, dstWhite) {
  const src = mulMatVec(BRADFORD, srcWhite);
  const dst = mulMatVec(BRADFORD, dstWhite);
  const scale = diag([dst[0] / src[0], dst[1] / src[1], dst[2] / src[2]]);
  return mulMatMat(invert3(BRADFORD), mulMatMat(scale, BRADFORD));
}

const conversionCache = new Map();
export function getConversion(illuminant) {
  if (!ILLUMINANTS[illuminant]) throw new Error(`Неизвестный источник: ${illuminant}`);
  if (!conversionCache.has(illuminant)) {
    const nativeWhite = whitePoint(SRGB_SPACE.white);
    const white = whitePoint(illuminant);
    const native = rgbToXyzMatrix(SRGB_SPACE.primaries, nativeWhite);
    const adapt = bradfordMatrix(nativeWhite, white);
    const rgbToXyz = mulMatMat(adapt, native);
    conversionCache.set(illuminant, { white, rgbToXyz, xyzToRgb: invert3(rgbToXyz) });
  }
  return conversionCache.get(illuminant);
}

export const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export const GAMUT_MODES = { clip: 'Clipping (обрезание)', scale: 'Scaling (масштабирование)' };

const GAMUT_TOLERANCE = 0.5 / 255;

export function mapToGamut(linear, mode = 'clip') {
  const encoded = linear.map(linearToSrgb);
  const outOfGamut = encoded.some(c => c < -GAMUT_TOLERANCE || c > 1 + GAMUT_TOLERANCE);
  const clamp01 = v => Math.max(0, Math.min(1, v));
  if (!outOfGamut || mode === 'clip') return { rgb: encoded.map(clamp01), outOfGamut };
  if (mode !== 'scale') throw new Error(`Неизвестная стратегия: ${mode}`);
  const lo = Math.min(0, ...linear), hi = Math.max(1, ...linear);
  const scaled = linear.map(v => clamp01((v - lo) / (hi - lo)));
  return { rgb: scaled.map(linearToSrgb).map(clamp01), outOfGamut };
}

export function rgbToXyz(rgb, illuminant = 'D65') {
  const { rgbToXyz: M } = getConversion(illuminant);
  return mulMatVec(M, rgb.map(c => srgbToLinear(c / 255)));
}

export function xyzToRgb(xyz, illuminant = 'D65', gamutMode = 'clip') {
  const { xyzToRgb: M } = getConversion(illuminant);
  const { rgb, outOfGamut } = mapToGamut(mulMatVec(M, xyz), gamutMode);
  return { rgb: rgb.map(c => c * 255), outOfGamut };
}

export function xyzToLab(xyz, illuminant = 'D65') {
  const { white } = getConversion(illuminant);
  const f = t => (t > LAB_EPSILON ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116);
  const [fx, fy, fz] = xyz.map((v, i) => f(v / white[i]));
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToXyz([L, a, b], illuminant = 'D65') {
  const { white } = getConversion(illuminant);
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = t => (t ** 3 > LAB_EPSILON ? t ** 3 : (116 * t - 16) / LAB_KAPPA);
  const yr = L > LAB_KAPPA * LAB_EPSILON ? fy ** 3 : L / LAB_KAPPA;
  return [inv(fx) * white[0], yr * white[1], inv(fz) * white[2]];
}

export const CMYK_MODES = {
  GCR: 'GCR — замена серой компоненты',
  UCR: 'UCR — удаление подложечного цвета',
};

export const UCR_SHADOW_THRESHOLD = 0.5;

export function rgbToCmyk(rgb, mode = 'GCR', ucrThreshold = UCR_SHADOW_THRESHOLD) {
  const cmy = rgb.map(v => 1 - v / 255);
  const grey = Math.min(...cmy);
  let k;
  if (mode === 'GCR') {
    k = grey;
  } else if (mode === 'UCR') {
    k = grey <= ucrThreshold ? 0 : grey * (grey - ucrThreshold) / (1 - ucrThreshold);
  } else {
    throw new Error(`Неизвестный алгоритм цветоделения: ${mode}`);
  }
  if (k >= 1 - 1e-12) return [0, 0, 0, 100];
  return [...cmy.map(v => (v - k) / (1 - k)), k].map(v => v * 100);
}

export function cmykToRgb([c, m, y, k]) {
  const kk = k / 100;
  return [c, m, y].map(v => 255 * (1 - v / 100) * (1 - kk));
}

export const toHex = rgb =>
  '#' + rgb.map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('').toUpperCase();

export function fromHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Некорректный HEX: ${hex}`);
  return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
}
