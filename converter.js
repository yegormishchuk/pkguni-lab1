const RGB_TO_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041],
];

function inv3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}
const XYZ_TO_RGB = inv3(RGB_TO_XYZ);
const mul = (m, v) => m.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

const WHITE = [0.95047, 1.0, 1.08883];

function rgbToXyz(r, g, b) {
  const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return mul(RGB_TO_XYZ, [lin(r / 255), lin(g / 255), lin(b / 255)]);
}

function xyzToRgb(x, y, z) {
  const gamma = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.sign(c) * Math.abs(c) ** (1 / 2.4) - 0.055);
  const rgb = mul(XYZ_TO_RGB, [x, y, z]).map(gamma);
  const clipped = rgb.some(c => c < 0 || c > 1);
  const [r, g, b] = rgb.map(c => Math.trunc(Math.max(0, Math.min(1, c)) * 255));
  return { r, g, b, clipped };
}

function xyzToLab(x, y, z) {
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / WHITE[0]), fy = f(y / WHITE[1]), fz = f(z / WHITE[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToXyz(L, a, b) {
  const fInv = t => (t > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const fy = (L + 16) / 116;
  return [fInv(fy + a / 500) * WHITE[0], fInv(fy) * WHITE[1], fInv(fy - b / 200) * WHITE[2]];
}
