const MODELS = {
  rgb: { title: 'RGB', labels: ['R', 'G', 'B'], min: [0, 0, 0], max: [255, 255, 255], step: 1, digits: 0 },
  xyz: { title: 'XYZ', labels: ['X', 'Y', 'Z'], min: [0, 0, 0], max: [1.2, 1.2, 1.2], step: 0.001, digits: 3 },
  lab: { title: 'LAB', labels: ['L', 'A', 'B'], min: [0, -128, -128], max: [100, 128, 128], step: 0.1, digits: 1 },
};

const controls = {};
const modelsEl = document.getElementById('models');

for (const [key, m] of Object.entries(MODELS)) {
  const fs = document.createElement('fieldset');
  fs.innerHTML = `<legend>${m.title}</legend>`;
  controls[key] = m.labels.map((label, i) => {
    const id = `${key}${i}`;
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML =
      `<label for="${id}">${label}</label>` +
      `<input type="range" id="${id}" min="${m.min[i]}" max="${m.max[i]}" step="${m.step}">` +
      `<input type="number" aria-label="${m.title} ${label}" min="${m.min[i]}" max="${m.max[i]}" step="${m.step}">`;
    fs.appendChild(row);
    const [range, num] = row.querySelectorAll('input');
    range.addEventListener('input', () => { num.value = range.value; updateFrom(key); });
    num.addEventListener('input', () => {
      if (num.value === '' || isNaN(+num.value)) return;
      range.value = num.value;
      updateFrom(key);
    });
    return { range, num };
  });
  modelsEl.appendChild(fs);
}

function read(key) {
  return controls[key].map(({ num }, i) => {
    const m = MODELS[key];
    return Math.max(m.min[i], Math.min(m.max[i], +num.value));
  });
}

function write(key, values) {
  const m = MODELS[key];
  controls[key].forEach(({ range, num }, i) => {
    const v = Math.max(m.min[i], Math.min(m.max[i], values[i]));
    const s = v.toFixed(m.digits);
    range.value = s;
    num.value = s;
  });
}

const preview = document.getElementById('preview');
const hexEl = document.getElementById('hex');
const colorInput = document.getElementById('colorInput');
const warning = document.getElementById('warning');

function setPreview(r, g, b) {
  const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  preview.style.background = hex;
  hexEl.textContent = hex.toUpperCase();
  colorInput.value = hex;
}

function updateFrom(source) {
  let rgb, xyz, lab, clipped = false;

  if (source === 'rgb') {
    rgb = read('rgb').map(Math.round);
    xyz = rgbToXyz(...rgb);
    lab = xyzToLab(...xyz);
  } else if (source === 'xyz') {
    xyz = read('xyz');
    lab = xyzToLab(...xyz);
    const res = xyzToRgb(...xyz);
    rgb = [res.r, res.g, res.b];
    clipped = res.clipped;
  } else {
    lab = read('lab');
    xyz = labToXyz(...lab);
    const res = xyzToRgb(...xyz);
    rgb = [res.r, res.g, res.b];
    clipped = res.clipped;
  }

  if (source !== 'rgb') write('rgb', rgb);
  if (source !== 'xyz') write('xyz', xyz);
  if (source !== 'lab') write('lab', lab);

  warning.hidden = !clipped;
  setPreview(...rgb);
}

colorInput.addEventListener('input', () => {
  const h = colorInput.value;
  write('rgb', [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
  updateFrom('rgb');
});

write('rgb', [255, 0, 0]);
updateFrom('rgb');
