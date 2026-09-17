import { MODEL_SPECS } from '../viewmodel/colorViewModel.js';
import { ILLUMINANTS, GAMUT_MODES, CMYK_MODES } from '../model/colorMath.js';

export class ColorView {
  constructor(root, viewModel) {
    this.vm = viewModel;
    this.el = {
      models: root.querySelector('#models'),
      preview: root.querySelector('#preview'),
      hex: root.querySelector('#hex'),
      colorInput: root.querySelector('#colorInput'),
      warning: root.querySelector('#warning'),
      illuminant: root.querySelector('#illuminant'),
      gamutMode: root.querySelector('#gamutMode'),
      cmykMode: root.querySelector('#cmykMode'),
      white: root.querySelector('#white'),
      matrix: root.querySelector('#matrix'),
    };
    this.fillSelect(this.el.illuminant, ILLUMINANTS, v => v.title, key => this.vm.setIlluminant(key));
    this.fillSelect(this.el.gamutMode, GAMUT_MODES, v => v, key => this.vm.setGamutMode(key));
    this.fillSelect(this.el.cmykMode, CMYK_MODES, v => v, key => this.vm.setCmykMode(key));
    this.el.colorInput.addEventListener('input', () => this.vm.setHex(this.el.colorInput.value));
    this.controls = this.buildModels();
    this.vm.subscribe(state => this.render(state));
  }

  fillSelect(select, options, text, onChange) {
    for (const [key, value] of Object.entries(options)) {
      select.add(new Option(text(value), key));
    }
    select.addEventListener('change', () => onChange(select.value));
  }

  buildModels() {
    const controls = {};
    for (const [key, spec] of Object.entries(MODEL_SPECS)) {
      const fs = document.createElement('fieldset');
      fs.innerHTML = `<legend>${spec.title}</legend>`;
      controls[key] = spec.labels.map((label, i) => {
        const id = `${key}${i}`;
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML =
          `<label for="${id}">${label}</label>` +
          `<input type="range" id="${id}" min="${spec.min[i]}" max="${spec.max[i]}" step="${spec.step}">` +
          `<input type="number" aria-label="${spec.title} ${label}" min="${spec.min[i]}" max="${spec.max[i]}" step="${spec.step}">`;
        fs.appendChild(row);
        const [range, num] = row.querySelectorAll('input');
        range.addEventListener('input', () => this.vm.setComponent(key, i, range.value));
        num.addEventListener('input', () => {
          if (num.value !== '' && !isNaN(+num.value)) this.vm.setComponent(key, i, num.value);
        });
        num.addEventListener('change', () => this.render(this.vm.getState()));
        return { range, num };
      });
      this.el.models.appendChild(fs);
    }
    return controls;
  }

  render(state) {
    for (const [key, rows] of Object.entries(this.controls)) {
      rows.forEach(({ range, num }, i) => {
        const value = String(state.values[key][i]);
        range.value = value;
        if (document.activeElement !== num) num.value = value;
        range.style.setProperty('--track', `linear-gradient(to right, ${state.gradients[key][i].join(', ')})`);
      });
    }
    this.el.preview.style.background = state.hex;
    this.el.hex.textContent = state.hex;
    this.el.colorInput.value = state.hex.toLowerCase();
    this.el.warning.hidden = !state.outOfGamut;
    this.el.warning.textContent = state.gamutMode === 'clip'
      ? 'Цвет вне охвата sRGB: значения RGB обрезаны до границ (Clipping)'
      : 'Цвет вне охвата sRGB: диапазон RGB пропорционально сжат (Scaling)';
    this.el.illuminant.value = state.illuminant;
    this.el.gamutMode.value = state.gamutMode;
    this.el.cmykMode.value = state.cmykMode;
    this.el.white.textContent = state.white.map(v => v.toFixed(5)).join(', ');
    this.el.matrix.textContent = state.matrix
      .map(row => row.map(v => v.toFixed(7).padStart(11)).join(' ')).join('\n');
  }
}
