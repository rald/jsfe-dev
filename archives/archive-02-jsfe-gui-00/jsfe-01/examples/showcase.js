import {
  GUI,
  SceneNode,
  Command,
  Panel,
  Button,
  Label,
  Slider,
  Toggle
} from '../src/gui.js';

/**
 * Custom Command implementation demonstrating Command Pattern + Undo/Redo history.
 */
class SetWidgetPropCommand extends Command {
  constructor(widget, key, nextValue) {
    super();
    this.widget = widget;
    this.key = key;
    this.prevValue = widget.model.get(key);
    this.nextValue = nextValue;
  }

  execute() {
    this.widget.model.set(this.key, this.nextValue);
  }

  undo() {
    this.widget.model.set(this.key, this.prevValue);
  }
}

/**
 * Custom Composite Widget demonstrating extensibility via OOP inheritance & SceneNode.
 */
class StatusBadge extends Panel {
  constructor(options = {}) {
    super({
      width: 240,
      height: 36,
      theme: {
        bg: '#232428',
        border: '#3f4147',
        radius: 6
      },
      ...options
    });
    this.textLabel = new Label({
      x: 12,
      y: 6,
      width: 216,
      height: 24,
      align: 'center',
      text: options.text ?? 'Ready'
    });
    this.add(this.textLabel);
  }

  setStatus(text, accentColor = '#5865f2') {
    this.model.set('theme', {
      ...this.model.get('theme'),
      border: accentColor
    });
    this.textLabel.setProps({ text });
  }
}

// 1. Initialize GUI Facade
const gui = new GUI('#app', { clearColor: '#111214' });

// 2. Register a custom component into the ComponentFactory (Factory Pattern)
gui.factory.register('badge', (opts) => new StatusBadge(opts));

// 3. Left Panel: Core Widgets & Observer Event Bindings
const controlsPanel = gui.create('panel', {
  x: 24,
  y: 24,
  width: 280,
  height: 372,
  title: '1. MVC Widgets & Observers'
});

const readoutLabel = gui.create('label', {
  x: 16,
  y: 40,
  width: 248,
  text: 'Opacity: 100% | Grid: ON'
}, controlsPanel);

let opacity = 100;
let gridEnabled = true;

const syncReadout = () => {
  readoutLabel.setProps({
    text: `Opacity: ${opacity}% | Grid: ${gridEnabled ? 'ON' : 'OFF'}`
  });
};

const opacitySlider = gui.create('slider', {
  x: 16,
  y: 78,
  width: 248,
  min: 0,
  max: 100,
  step: 5,
  value: 100,
  label: 'Layer Opacity'
}, controlsPanel);

opacitySlider.on('change:value', ({ value }) => {
  opacity = value;
  syncReadout();
});

const gridToggle = gui.create('toggle', {
  x: 16,
  y: 128,
  width: 248,
  checked: true,
  label: 'Snap to Grid'
}, controlsPanel);

gridToggle.on('change:checked', ({ value }) => {
  gridEnabled = value;
  syncReadout();
});

const lockToggle = gui.create('toggle', {
  x: 16,
  y: 168,
  width: 248,
  checked: false,
  label: 'Disable Action Button'
}, controlsPanel);

const actionBtn = gui.create('button', {
  x: 16,
  y: 214,
  width: 248,
  height: 36,
  label: 'Trigger Primary Action'
}, controlsPanel);

// Dynamically mutate enabled state via Model
lockToggle.on('change:checked', ({ value }) => {
  actionBtn.setProps({
    enabled: !value,
    label: value ? 'Action Locked' : 'Trigger Primary Action'
  });
});

// Custom Factory-created composite badge
const statusBadge = gui.create('badge', {
  x: 16,
  y: 268,
  width: 248,
  text: 'Idle — Awaiting Input'
}, controlsPanel);

let clickCount = 0;
actionBtn.on('click', () => {
  clickCount += 1;
  statusBadge.setStatus(`Triggered ${clickCount}x`, '#23a55a');
});

// 4. Right Panel: Command Pattern (Undo/Redo), Nested Scene Graph & Custom Themes
const advancedPanel = gui.create('panel', {
  x: 324,
  y: 24,
  width: 292,
  height: 372,
  title: '2. Commands & Scene Hierarchy'
});

const themeHint = gui.create('label', {
  x: 16,
  y: 40,
  width: 260,
  text: 'Command History (Undo / Redo):'
}, advancedPanel);

const targetBox = gui.create('panel', {
  x: 16,
  y: 72,
  width: 260,
  height: 92,
  title: 'Nested Child Container',
  theme: {
    bg: '#2b2d31',
    border: '#5865f2',
    radius: 8
  }
}, advancedPanel);

const nestedLabel = gui.create('label', {
  x: 14,
  y: 38,
  width: 232,
  align: 'center',
  text: 'Accent: Indigo (#5865f2)'
}, targetBox);

const accentPresets = [
  { name: 'Indigo', color: '#5865f2' },
  { name: 'Emerald', color: '#23a55a' },
  { name: 'Crimson', color: '#da373c' },
  { name: 'Amber', color: '#f0b232' }
];
let presetIndex = 0;

const cycleThemeBtn = gui.create('button', {
  x: 16,
  y: 180,
  width: 260,
  height: 36,
  label: 'Execute Theme Command'
}, advancedPanel);

cycleThemeBtn.on('click', () => {
  presetIndex = (presetIndex + 1) % accentPresets.length;
  const preset = accentPresets[presetIndex];
  const nextTheme = {
    ...targetBox.model.get('theme'),
    border: preset.color
  };

  gui.history.execute(new SetWidgetPropCommand(targetBox, 'theme', nextTheme));
  nestedLabel.setProps({ text: `Accent: ${preset.name} (${preset.color})` });
  statusBadge.setStatus(`Theme -> ${preset.name}`, preset.color);
});

const undoBtn = gui.create('button', {
  x: 16,
  y: 228,
  width: 124,
  height: 34,
  label: 'Undo'
}, advancedPanel);

const redoBtn = gui.create('button', {
  x: 152,
  y: 228,
  width: 124,
  height: 34,
  label: 'Redo'
}, advancedPanel);

undoBtn.on('click', () => {
  gui.history.undo();
  const currentBorder = targetBox.model.get('theme').border;
  nestedLabel.setProps({ text: `Accent: ${currentBorder}` });
  statusBadge.setStatus('Command Undone', '#f0b232');
});

redoBtn.on('click', () => {
  gui.history.redo();
  const currentBorder = targetBox.model.get('theme').border;
  nestedLabel.setProps({ text: `Accent: ${currentBorder}` });
  statusBadge.setStatus('Command Redone', '#5865f2');
});

const visibilityToggle = gui.create('toggle', {
  x: 16,
  y: 280,
  width: 260,
  checked: true,
  label: 'Show Nested Container'
}, advancedPanel);

visibilityToggle.on('change:checked', ({ value }) => {
  targetBox.setProps({ visible: value });
});

const resetAllBtn = gui.create('button', {
  x: 16,
  y: 320,
  width: 260,
  height: 34,
  label: 'Reset All Showcase State',
  theme: {
    bg: '#3a2426',
    bgHover: '#4f2d30',
    bgActive: '#633539',
    border: '#da373c',
    accent: '#da373c'
  }
}, advancedPanel);

resetAllBtn.on('click', () => {
  opacitySlider.model.setValue(100);
  gridToggle.model.set('checked', true);
  lockToggle.model.set('checked', false);
  visibilityToggle.model.set('checked', true);
  clickCount = 0;
  statusBadge.setStatus('Showcase Reset', '#5865f2');
});
