import {
  Model,
  Stage,
  Panel,
  Button,
  Label,
  Window,
  Frame,
  WindowEvent,
  Controller,
  TextField,
  TextArea,
  Checkbox,
  FlowLayout,
  GridLayout,
  BorderLayout
} from './awt.js';

// 1. Initialize Stage
const canvas = document.getElementById('myCanvas');
const stage = new Stage(canvas);

// 2. Define Model
const model = new Model({
  clicks: 0,
  theme: 'dark',
  editingEnabled: true,
  lastAction: 'Ready'
});

// 3. Top-level Counter Panel using FlowLayout (AWT style)
const topBar = new Panel(16, 12, 554, 44, new FlowLayout(FlowLayout.LEFT, 10, 8));
const counterLabel = new Label(0, 14, 'Clicks: 0');
const counterBtn = new Button(0, 0, 105, 28, 'Increment');
const statusLabel = new Label(0, 14, 'Status: Ready');

counterBtn.addActionListener((e) => {
  model.set('clicks', model.get('clicks') + 1);
  model.set('lastAction', `ActionEvent (${e.actionCommand})`);
});

topBar.add(counterLabel);
topBar.add(counterBtn);
topBar.add(statusLabel);

// 4. Decorated, Resizable Frame with Title Bar, Checkbox, TextField, TextArea, and GridLayout footer
const frame = new Frame('AWT Settings Frame', 20, 72, 240, 308);
frame.addWindowListener((e) => {
  if (e.id === WindowEvent.WINDOW_CLOSING) {
    model.set('lastAction', 'Frame WINDOW_CLOSING');
  } else if (e.id === WindowEvent.WINDOW_CLOSED) {
    model.set('lastAction', 'Frame WINDOW_CLOSED');
  }
});

const themeBtn = new Button(12, 36, 130, 28, 'Light Mode');
themeBtn.addActionListener(() => {
  const nextTheme = model.get('theme') === 'dark' ? 'light' : 'dark';
  model.set('theme', nextTheme);
  model.set('lastAction', `Theme -> ${nextTheme}`);
});
frame.add(themeBtn);

const lockCheckbox = new Checkbox(12, 74, 16, 16, 'Enable Inputs', true, (checked, itemEvent) => {
  model.set('editingEnabled', checked);
  model.set('lastAction', `Checkbox ${itemEvent.stateChange === 1 ? 'SELECTED' : 'DESELECTED'}`);
});
frame.add(lockCheckbox);

frame.add(new Label(12, 114, 'Name:'));
const nameField = new TextField(12, 122, 210, 28, 'John Doe');
nameField.addFocusListener((e) => {
  model.set('lastAction', `NameField focus id=${e.id}`);
});
nameField.addActionListener((e) => {
  model.set('lastAction', `Submitted: ${e.actionCommand}`);
});
frame.add(nameField);

frame.add(new Label(12, 170, 'Notes:'));
const notesArea = new TextArea(
  [
    'Initial AWT note...',
    'Line 2: Java AWT-style TextArea with built-in scrollbars',
    'Line 3: Drag vertical or horizontal scrollbar thumbs',
    'Line 4: Supports selection, append(), insert(), and getText()',
    'Line 5: Extra line to test vertical scrolling',
    'Line 6: Extra line to test vertical scrolling'
  ].join('\n'),
  4,
  26,
  TextArea.SCROLLBARS_BOTH
);
notesArea.setBounds(12, 178, 210, 78);
frame.add(notesArea);

const quickGrid = new Panel(12, 264, 210, 34, new GridLayout(1, 2, 8, 4));
const clearBtn = new Button(0, 0, 90, 26, 'Clear Notes');
clearBtn.addActionListener(() => {
  notesArea.setText('');
  model.set('lastAction', 'Cleared notes');
});

const resetBtn = new Button(0, 0, 90, 26, 'Reset Count');
resetBtn.addActionListener(() => {
  model.set('clicks', 0);
  model.set('lastAction', 'Reset counter');
});

quickGrid.add(clearBtn);
quickGrid.add(resetBtn);
frame.add(quickGrid);

// 5. Right-side Inspector Panel using BorderLayout with direct TextArea (no ScrollPane)
const inspector = new Panel(280, 72, 290, 308, new BorderLayout(8, 8));
const inspectorTitle = new Label(0, 14, 'AWT Inspector');
const inspectorSummary = new TextArea(
  'Interact with controls to inspect state.',
  8,
  30,
  TextArea.SCROLLBARS_BOTH
);
const applyBtn = new Button(0, 0, 120, 28, 'Snapshot State');

applyBtn.addActionListener(() => {
  inspectorSummary.setText(
    [
      `Clicks: ${model.get('clicks')}`,
      `Theme: ${model.get('theme')}`,
      `Inputs Enabled: ${model.get('editingEnabled')}`,
      `Name: ${nameField.getText()}`,
      `Notes Len: ${notesArea.getText().length}`
    ].join('\n')
  );
  model.set('lastAction', 'Snapshot captured');
});

inspector.add(inspectorTitle, BorderLayout.NORTH);
inspector.add(inspectorSummary, BorderLayout.CENTER);
inspector.add(applyBtn, BorderLayout.SOUTH);

// 6. Add to Stage
stage.add(topBar);
stage.add(frame);
stage.add(inspector);

// 7. Controller: Bind Model to View
class ShowcaseController extends Controller {
  updateView() {
    const clicks = this.model.get('clicks');
    const theme = this.model.get('theme');
    const enabled = this.model.get('editingEnabled');
    const lastAction = this.model.get('lastAction');

    counterLabel.text = `Clicks: ${clicks}`;
    statusLabel.text = `Event: ${lastAction}`;
    themeBtn.label = theme === 'dark' ? 'Light Mode' : 'Dark Mode';

    nameField.setEnabled(enabled);
    notesArea.setEnabled(enabled);
    clearBtn.setEnabled(enabled);

    this.stage.setTheme(theme);

    if (typeof document !== 'undefined' && document.body) {
      document.body.style.backgroundColor = theme === 'dark' ? '#1a1c2c' : '#f4f4f4';
      document.body.style.color = theme === 'dark' ? '#f4f4f4' : '#1a1c2c';
    }
  }
}

const controller = new ShowcaseController(model, counterLabel, stage);
controller.updateView();
