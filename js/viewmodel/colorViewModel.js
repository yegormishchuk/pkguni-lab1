import {
  ILLUMINANTS, GAMUT_MODES, CMYK_MODES, getConversion,
  rgbToXyz, xyzToRgb, xyzToLab, labToXyz, rgbToCmyk, cmykToRgb, toHex, fromHex,
} from '../model/colorMath.js';

export const MODEL_SPECS = {
  rgb: { title: 'RGB', labels: ['R', 'G', 'B'], min: [0, 0, 0], max: [255, 255, 255], step: 1, digits: 0, stops: 2 },
  xyz: { title: 'XYZ', labels: ['X', 'Y', 'Z'], min: [0, 0, 0], max: [1.2, 1.2, 1.2], step: 0.001, digits: 3, stops: 16 },
  lab: { title: 'LAB', labels: ['L', 'a', 'b'], min: [0, -128, -128], max: [100, 128, 128], step: 0.1, digits: 1, stops: 16 },
  cmyk: { title: 'CMYK, %', labels: ['C', 'M', 'Y', 'K'], min: [0, 0, 0, 0], max: [100, 100, 100, 100], step: 0.1, digits: 1, stops: 2 },
};

export class ColorViewModel {
  constructor({ illuminant = 'D65', gamutMode = 'clip', cmykMode = 'GCR', rgb = [255, 0, 0] } = {}) {
    this.illuminant = illuminant;
    this.gamutMode = gamutMode;
    this.cmykMode = cmykMode;
    this.listeners = new Set();
    this.update('rgb', rgb);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  setComponent(model, index, value) {
    const values = [...this.values[model]];
    values[index] = Number(value);
    this.setValues(model, values);
  }

  setValues(model, values) {
    const spec = MODEL_SPECS[model];
    if (!spec) throw new Error(`Неизвестная модель: ${model}`);
    const clamped = values.map((v, i) => clampTo(spec, i, Number(v)));
    if (clamped.some(Number.isNaN)) return;
    this.update(model, clamped);
    this.notify();
  }

  setHex(hex) {
    this.setValues('rgb', fromHex(hex));
  }

  setIlluminant(illuminant) {
    if (!ILLUMINANTS[illuminant]) throw new Error(`Неизвестный источник: ${illuminant}`);
    this.illuminant = illuminant;
    this.update('rgb', this.values.rgb);
    this.notify();
  }

  setGamutMode(mode) {
    if (!GAMUT_MODES[mode]) throw new Error(`Неизвестная стратегия: ${mode}`);
    this.gamutMode = mode;
    this.update(this.source, this.sourceValues);
    this.notify();
  }

  setCmykMode(mode) {
    if (!CMYK_MODES[mode]) throw new Error(`Неизвестный алгоритм: ${mode}`);
    this.cmykMode = mode;
    this.update('rgb', this.values.rgb);
    this.notify();
  }

  compute(source, input) {
    const { illuminant, gamutMode, cmykMode } = this;
    let rgb, xyz, lab, cmyk, outOfGamut = false;
    const fromXyz = () => ({ rgb, outOfGamut } = xyzToRgb(xyz, illuminant, gamutMode));
    switch (source) {
      case 'rgb':
        rgb = input;
        xyz = rgbToXyz(rgb, illuminant);
        lab = xyzToLab(xyz, illuminant);
        break;
      case 'xyz':
        xyz = input;
        lab = xyzToLab(xyz, illuminant);
        fromXyz();
        break;
      case 'lab':
        lab = input;
        xyz = labToXyz(lab, illuminant);
        fromXyz();
        break;
      case 'cmyk':
        cmyk = input;
        rgb = cmykToRgb(cmyk);
        xyz = rgbToXyz(rgb, illuminant);
        lab = xyzToLab(xyz, illuminant);
        break;
      default:
        throw new Error(`Неизвестная модель: ${source}`);
    }
    cmyk ??= rgbToCmyk(rgb, cmykMode);
    return { values: { rgb, xyz, lab, cmyk }, outOfGamut };
  }

  update(source, input) {
    this.source = source;
    this.sourceValues = [...input];
    const { values, outOfGamut } = this.compute(source, input);
    this.values = values;
    this.outOfGamut = outOfGamut;
  }

  sliderGradient(model, index) {
    const spec = MODEL_SPECS[model];
    return Array.from({ length: spec.stops }, (_, s) => {
      const values = [...this.values[model]];
      values[index] = spec.min[index] + (spec.max[index] - spec.min[index]) * s / (spec.stops - 1);
      return toHex(this.compute(model, values).values.rgb);
    });
  }

  getState() {
    const display = {};
    const gradients = {};
    for (const [key, spec] of Object.entries(MODEL_SPECS)) {
      display[key] = this.values[key].map((v, i) => round(clampTo(spec, i, v), spec.digits));
      gradients[key] = spec.labels.map((_, i) => this.sliderGradient(key, i));
    }
    const { white, rgbToXyz: matrix } = getConversion(this.illuminant);
    return {
      values: display,
      gradients,
      hex: toHex(this.values.rgb),
      outOfGamut: this.outOfGamut,
      illuminant: this.illuminant,
      gamutMode: this.gamutMode,
      cmykMode: this.cmykMode,
      white,
      matrix,
    };
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach(fn => fn(state));
  }
}

const clampTo = (spec, i, v) => Math.max(spec.min[i], Math.min(spec.max[i], v));
const round = (v, digits) => {
  const r = Number(v.toFixed(digits));
  return Object.is(r, -0) ? 0 : r;
};
