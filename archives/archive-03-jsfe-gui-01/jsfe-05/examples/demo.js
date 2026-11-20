import { GUI } from '../src/gui.js';

const gui = new GUI('#app', { clearColor: '#111214' });

const panel = gui.create('panel', {
  x: 40,
  y: 40,
  width: 300,
  height: 340,
  title: 'Scene Controls'
});

const statusLabel = gui.create('label', {
  x: 16,
  y: 42,
  width: 268,
  text: 'Speed: 50 | Active: OFF'
}, panel);

let speed = 50;
let active = false;

const refreshStatus = () => {
  statusLabel.setProps({ text: `Speed: ${speed} | Active: ${active ? 'ON' : 'OFF'}` });
};

const speedSlider = gui.create('slider', {
  x: 16,
  y: 84,
  width: 268,
  min: 0,
  max: 100,
  step: 1,
  value: 50,
  label: 'Simulation Speed'
}, panel);

speedSlider.on('change:value', ({ value }) => {
  speed = value;
  refreshStatus();
});

const activeToggle = gui.create('toggle', {
  x: 16,
  y: 136,
  checked: false,
  label: 'Enable Physics'
}, panel);

activeToggle.on('change:checked', ({ value }) => {
  active = value;
  refreshStatus();
});

const resetBtn = gui.create('button', {
  x: 16,
  y: 188,
  width: 268,
  height: 38,
  label: 'Reset Parameters'
}, panel);

resetBtn.on('click', () => {
  speedSlider.model.setValue(50);
  activeToggle.model.set('checked', false);
});
