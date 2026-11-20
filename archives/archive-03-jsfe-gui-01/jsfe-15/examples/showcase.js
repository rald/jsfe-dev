import {
  GUI,
  Command,
  Panel,
  Button,
  Label,
  Slider,
  Toggle,
  Window,
  Menu,
  MenuItem,
  MenuBar
} from '../src/gui.js';

/**
 * Custom Command for Undo/Redo on Window or Widget properties.
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
 * Custom Composite Widget via OOP inheritance.
 */
class StatusBadge extends Panel {
  constructor(options = {}) {
    super({
      width: 240,
      height: 34,
      theme: {
        bg: '#232428',
        border: '#3f4147',
        radius: 6
      },
      ...options
    });
    this.textLabel = new Label({
      x: 10,
      y: 5,
      width: 220,
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

const gui = new GUI('#app', { clearColor: '#111214' });
gui.factory.register('badge', (opts) => new StatusBadge(opts));

// 1. Draggable, Resizable Window with Titlebar & Minimize / Maximize / Close
const inspectorWin = gui.create('window', {
  x: 32,
  y: 46,
  width: 340,
  height: 340,
  title: 'Inspector Window',
  minimizable: true,
  maximizable: true,
  closable: true,
  resizable: true
});

const statusBadge = gui.create('badge', {
  x: 16,
  y: 14,
  width: 308,
  text: 'Drag titlebar or use window buttons'
});
inspectorWin.addContent(statusBadge);

const gainSlider = gui.create('slider', {
  x: 16,
  y: 62,
  width: 308,
  min: 0,
  max: 100,
  step: 5,
  value: 75,
  label: 'Master Gain'
});
inspectorWin.addContent(gainSlider);

const muteToggle = gui.create('toggle', {
  x: 16,
  y: 112,
  width: 308,
  checked: false,
  label: 'Mute Output'
});
inspectorWin.addContent(muteToggle);

const accentPresets = ['#5865f2', '#23a55a', '#f0b232', '#da373c'];
let accentIdx = 0;

const themeBtn = gui.create('button', {
  x: 16,
  y: 154,
  width: 148,
  height: 34,
  label: 'Cycle Accent'
});
inspectorWin.addContent(themeBtn);

const undoBtn = gui.create('button', {
  x: 176,
  y: 154,
  width: 148,
  height: 34,
  label: 'Undo Accent'
});
inspectorWin.addContent(undoBtn);

themeBtn.on('click', () => {
  accentIdx = (accentIdx + 1) % accentPresets.length;
  const color = accentPresets[accentIdx];
  const nextTheme = { ...inspectorWin.model.get('theme'), accent: color };
  gui.history.execute(new SetWidgetPropCommand(inspectorWin, 'theme', nextTheme));
  statusBadge.setStatus(`Accent: ${color}`, color);
});

undoBtn.on('click', () => {
  gui.history.undo();
  statusBadge.setStatus('Reverted Accent', '#f0b232');
});

inspectorWin.on('minimize', () => statusBadge.setStatus('Window Minimized', '#f0b232'));
inspectorWin.on('maximize', () => statusBadge.setStatus('Window Maximized', '#23a55a'));
inspectorWin.on('restore', () => statusBadge.setStatus('Window Restored', '#5865f2'));
inspectorWin.on('close', () => {
  reopenBtn.setProps({ visible: true });
});

// Reopen button on canvas if closed
const reopenBtn = gui.create('button', {
  x: 24,
  y: 420,
  width: 180,
  height: 34,
  label: 'Reopen Window',
  visible: false
});
reopenBtn.on('click', () => {
  inspectorWin.setProps({ visible: true, minimized: false });
  reopenBtn.setProps({ visible: false });
  statusBadge.setStatus('Window Reopened', '#23a55a');
});

// 2. Submenu + Menu + MenuBar ("friends")
const exportSubmenu = new Menu({
  width: 170,
  items: [
    {
      label: 'Export JSON',
      shortcut: '⌘J',
      onSelect: () => statusBadge.setStatus('Exported JSON', '#23a55a')
    },
    {
      label: 'Export Canvas PNG',
      shortcut: '⌘P',
      onSelect: () => statusBadge.setStatus('Exported PNG', '#23a55a')
    }
  ]
});

const menuBar = gui.create('menubar', {
  x: 0,
  y: 0,
  width: 760,
  height: 28,
  menus: [
    {
      label: 'File',
      items: [
        {
          label: 'New Session',
          shortcut: '⌘N',
          onSelect: () => statusBadge.setStatus('New Session Created', '#5865f2')
        },
        {
          label: 'Export As',
          submenu: exportSubmenu
        },
        { separator: true },
        {
          label: 'Close Window',
          shortcut: '⌘W',
          onSelect: () => inspectorWin.close()
        }
      ]
    },
    {
      label: 'Window',
      items: [
        {
          label: 'Minimize',
          shortcut: '⌘M',
          onSelect: () => inspectorWin.minimize()
        },
        {
          label: 'Toggle Maximize',
          shortcut: '⌘Enter',
          onSelect: () => inspectorWin.maximize({ width: 760, height: 480 })
        },
        {
          label: 'Auto-Save State',
          checked: true,
          onSelect: ({ model }) => statusBadge.setStatus(
            `Auto-Save: ${model.get('checked') ? 'ON' : 'OFF'}`,
            '#5865f2'
          )
        }
      ]
    }
  ]
});

// Attach submenus to scene graph so they render and receive hit-tests
gui.add(exportSubmenu);
for (const entry of menuBar._entries) {
  gui.add(entry.menu);
}
