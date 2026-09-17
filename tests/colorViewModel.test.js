import test from 'node:test';
import assert from 'node:assert/strict';
import { ColorViewModel } from '../js/viewmodel/colorViewModel.js';

test('Начальное состояние RGB(255, 0, 0) пересчитывается во все модели', () => {
  const { values, hex, outOfGamut } = new ColorViewModel().getState();
  assert.deepEqual(values.rgb, [255, 0, 0]);
  assert.deepEqual(values.lab, [53.2, 80.1, 67.2]);
  assert.deepEqual(values.cmyk, [0, 100, 100, 0]);
  assert.equal(hex, '#FF0000');
  assert.equal(outOfGamut, false);
});

test('Изменение компонента уведомляет подписчиков', () => {
  const vm = new ColorViewModel();
  let last;
  vm.subscribe(s => (last = s));
  vm.setComponent('rgb', 1, 255);
  assert.equal(last.hex, '#FFFF00');
  assert.deepEqual(last.values.cmyk, [0, 0, 100, 0]);
});

test('Смена источника пересчитывает XYZ и LAB, сохраняя цвет', () => {
  const vm = new ColorViewModel();
  const d65 = vm.getState();
  vm.setIlluminant('D50');
  const d50 = vm.getState();
  assert.equal(d50.hex, d65.hex);
  assert.deepEqual(d50.values.lab, [54.3, 80.8, 69.9]);
  assert.notDeepEqual(d50.matrix, d65.matrix);
});

test('Стратегия охвата применяется к введённому вне охвата цвету', () => {
  const vm = new ColorViewModel();
  vm.setValues('lab', [50, 100, -100]);
  const clip = vm.getState();
  vm.setGamutMode('scale');
  const scale = vm.getState();
  assert.equal(clip.outOfGamut, true);
  assert.equal(scale.outOfGamut, true);
  assert.deepEqual(scale.values.lab, [50, 100, -100]);
  assert.notEqual(clip.hex, scale.hex);
});

test('Смена алгоритма цветоделения меняет CMYK, но не цвет', () => {
  const vm = new ColorViewModel({ rgb: [51, 51, 51] });
  assert.deepEqual(vm.getState().values.cmyk, [0, 0, 0, 80]);
  vm.setCmykMode('UCR');
  assert.deepEqual(vm.getState().values.cmyk, [61.5, 61.5, 61.5, 48]);
  assert.equal(vm.getState().hex, '#333333');
});

test('Ввод из CMYK', () => {
  const vm = new ColorViewModel();
  vm.setValues('cmyk', [0, 0, 0, 100]);
  assert.equal(vm.getState().hex, '#000000');
});

test('Градиент ползунка зависит от остальных компонентов', () => {
  const vm = new ColorViewModel({ rgb: [200, 0, 0] });
  assert.deepEqual(vm.getState().gradients.rgb[1], ['#C80000', '#C8FF00']);
  vm.setComponent('rgb', 0, 0);
  assert.deepEqual(vm.getState().gradients.rgb[1], ['#000000', '#00FF00']);
  assert.equal(vm.getState().gradients.lab[0].length, 16);
});

test('Значения ограничиваются диапазоном модели', () => {
  const vm = new ColorViewModel();
  vm.setComponent('rgb', 0, 999);
  assert.equal(vm.getState().values.rgb[0], 255);
});
