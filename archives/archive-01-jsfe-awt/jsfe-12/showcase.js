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
  BorderLayout,
  MenuComponent,
  MenuBar,
  Menu,
  MenuItem,
  CheckboxMenuItem,
  PopupMenu,
  MenuShortcut
} from './awt.js';

// 1. Initialize Stage
const canvas = document.getElementById('myCanvas');
const stage = new Stage(canvas);

// 2. Define Model
const model = new Model({
  clicks: 0,
  theme: 'dark',
  editingEnabled: true,
  wordWrapHint: false,
  lastAction: 'Ready'
});

// 3. Top-level Counter Panel using FlowLayout (AWT style)
const topBar = new Panel(16, 12, 568, 44, new FlowLayout(FlowLayout.LEFT, 10, 8));
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

// 4. Decorated, Resizable Frame with MenuBar, Menu, MenuItem, CheckboxMenuItem, Submenu & Shortcut
const frame = new Frame('AWT Settings Frame', 16, 66, 266, 318);
frame.addWindowListener((e) => {
  if (e.id === WindowEvent.WINDOW_CLOSING) {
    model.set('lastAction', 'Frame WINDOW_CLOSING');
  } else if (e.id === WindowEvent.WINDOW_CLOSED) {
    model.set('lastAction', 'Frame WINDOW_CLOSED');
  }
});

// Build AWT MenuBar
const menuBar = new MenuBar();

// File Menu with Shortcut & Submenu
const fileMenu = new Menu('File');
const newItem = new MenuItem('New Note', new MenuShortcut('n'), () => {
  notesArea.setText('');
  model.set('lastAction', 'Menu: New Note');
});
const appendSampleItem = new MenuItem('Append Sample', null, () => {
  notesArea.append('\nAdded via MenuItem!');
  model.set('lastAction', 'Menu: Append Sample');
});

const exportSubmenu = new Menu('Export As');
exportSubmenu.add(new MenuItem('Plain Text (.txt)', null, (e) => {
  model.set('lastAction', `Exported: ${e.actionCommand}`);
}));
exportSubmenu.add(new MenuItem('Markdown (.md)', null, (e) => {
  model.set('lastAction', `Exported: ${e.actionCommand}`);
}));

const exitItem = new MenuItem('Close Frame', null, () => {
  frame.dispose();
  model.set('lastAction', 'Menu: Close Frame');
});

fileMenu.add(newItem);
fileMenu.add(appendSampleItem);
fileMenu.addSeparator();
fileMenu.add(exportSubmenu);
fileMenu.addSeparator();
fileMenu.add(exitItem);

// View Menu with CheckboxMenuItem & Theme toggle
const viewMenu = new Menu('View');
const enableInputsMenuItem = new CheckboxMenuItem('Enable Inputs', true, null, (itemEvt) => {
  const checked = itemEvt.stateChange === 1;
  model.set('editingEnabled', checked);
  model.set('lastAction', `CheckboxMenuItem: Inputs ${checked ? 'ON' : 'OFF'}`);
});
const highlightMenuItem = new CheckboxMenuItem('Highlight Status', false, null, (itemEvt) => {
  const checked = itemEvt.stateChange === 1;
  model.set('wordWrapHint', checked);
  model.set('lastAction', `CheckboxMenuItem: Highlight ${checked ? 'ON' : 'OFF'}`);
});
const toggleThemeMenuItem = new MenuItem('Toggle Theme', new MenuShortcut('t'), () => {
  const nextTheme = model.get('theme') === 'dark' ? 'light' : 'dark';
  model.set('theme', nextTheme);
  model.set('lastAction', `Shortcut/Menu: Theme -> ${nextTheme}`);
});

viewMenu.add(enableInputsMenuItem);
viewMenu.add(highlightMenuItem);
viewMenu.addSeparator();
viewMenu.add(toggleThemeMenuItem);

menuBar.add(fileMenu);
menuBar.add(viewMenu);
frame.setMenuBar(menuBar);

// Frame body controls (shifted down slightly to account for MenuBar height)
const themeBtn = new Button(12, 34, 130, 26, 'Light Mode');
themeBtn.addActionListener(() => {
  const nextTheme = model.get('theme') === 'dark' ? 'light' : 'dark';
  model.set('theme', nextTheme);
  model.set('lastAction', `Theme -> ${nextTheme}`);
});
frame.add(themeBtn);

const lockCheckbox = new Checkbox(12, 68, 16, 16, 'Enable Inputs', true, (checked, itemEvent) => {
  model.set('editingEnabled', checked);
  model.set('lastAction', `Checkbox ${itemEvent.stateChange === 1 ? 'SELECTED' : 'DESELECTED'}`);
});
frame.add(lockCheckbox);

const nameLabel = new Label(12, 92, 'Name:');
nameLabel.setSize(210, 18);
frame.add(nameLabel);
const nameField = new TextField(12, 112, 236, 26, 'John Doe');
nameField.addFocusListener((e) => {
  model.set('lastAction', `NameField focus id=${e.id}`);
});
nameField.addActionListener((e) => {
  model.set('lastAction', `Submitted: ${e.actionCommand}`);
});
frame.add(nameField);

const notesLabel = new Label(12, 144, 'Notes:');
notesLabel.setSize(210, 18);
frame.add(notesLabel);
const notesArea = new TextArea(
  [
    'Try File / View menus in the Frame!',
    'Or click "Popup Menu" on the right.',
    'Press N or T for MenuShortcut keys.',
    'Line 4: Supports selection & scrollbars',
    'Line 5: Extra line to test scrolling'
  ].join('\n'),
  4,
  26,
  TextArea.SCROLLBARS_BOTH
);
notesArea.setBounds(12, 164, 236, 74);
frame.add(notesArea);

const quickRow = new Panel(12, 244, 242, 34, new FlowLayout(FlowLayout.CENTER, 5, 5));
const clearBtn = new Button(0, 0, 108, 16, 'Clear');
clearBtn.addActionListener(() => {
  notesArea.setText('');
  model.set('lastAction', 'Cleared notes');
});

const resetBtn = new Button(0, 0, 108, 16, 'Reset');
resetBtn.addActionListener(() => {
  model.set('clicks', 0);
  model.set('lastAction', 'Reset counter');
});

quickRow.add(clearBtn);
quickRow.add(resetBtn);
frame.add(quickRow);

// 5. Standalone AWT PopupMenu triggered from Inspector
const popupMenu = new PopupMenu('ContextActions');
popupMenu.add(new MenuItem('Increment Counter', new MenuShortcut('i'), () => {
  model.set('clicks', model.get('clicks') + 1);
  model.set('lastAction', 'PopupMenu: Increment');
}));
popupMenu.add(new MenuItem('Select All Notes', null, () => {
  notesArea.selectAll();
  model.set('lastAction', 'PopupMenu: Select All');
}));
popupMenu.addSeparator();
const popupLockItem = new CheckboxMenuItem('Lock Editing', false, null, (itemEvt) => {
  const locked = itemEvt.stateChange === 1;
  model.set('editingEnabled', !locked);
  model.set('lastAction', `PopupMenu: Lock ${locked ? 'ON' : 'OFF'}`);
});
popupMenu.add(popupLockItem);

// 6. Right-side Inspector Panel using BorderLayout with direct TextArea & PopupMenu trigger
const inspector = new Panel(294, 66, 290, 318, new BorderLayout(8, 8));
const inspectorTitle = new Label(0, 14, 'AWT Inspector + PopupMenu');
const inspectorSummary = new TextArea(
  'Use Frame MenuBar (File, View, Export As) or click Popup Menu below.',
  8,
  30,
  TextArea.SCROLLBARS_BOTH
);

const bottomActions = new Panel(0, 0, 270, 34, new FlowLayout(FlowLayout.CENTER, 8, 3));
const popupBtn = new Button(0, 0, 118, 28, 'Popup Menu');
const applyBtn = new Button(0, 0, 118, 28, 'Snapshot State');

popupBtn.addActionListener(() => {
  popupMenu.show(popupBtn, 0, -108);
  model.set('lastAction', 'PopupMenu shown');
});

applyBtn.addActionListener(() => {
  inspectorSummary.setText(
    [
      `Clicks: ${model.get('clicks')}`,
      `Theme: ${model.get('theme')}`,
      `Inputs Enabled: ${model.get('editingEnabled')}`,
      `Highlight: ${model.get('wordWrapHint')}`,
      `Name: ${nameField.getText()}`,
      `Notes Len: ${notesArea.getText().length}`
    ].join('\n')
  );
  model.set('lastAction', 'Snapshot captured');
});

bottomActions.add(popupBtn);
bottomActions.add(applyBtn);

inspector.add(inspectorTitle, BorderLayout.NORTH);
inspector.add(inspectorSummary, BorderLayout.CENTER);
inspector.add(bottomActions, BorderLayout.SOUTH);

// 7. Add to Stage
stage.add(topBar);
stage.add(frame);
stage.add(inspector);

// 8. Controller: Bind Model to View
class ShowcaseController extends Controller {
  updateView() {
    const clicks = this.model.get('clicks');
    const theme = this.model.get('theme');
    const enabled = this.model.get('editingEnabled');
    const highlight = this.model.get('wordWrapHint');
    const lastAction = this.model.get('lastAction');

    counterLabel.text = `Clicks: ${clicks}`;
    statusLabel.text = highlight ? `[!] ${lastAction}` : `Event: ${lastAction}`;
    themeBtn.label = theme === 'dark' ? 'Light Mode' : 'Dark Mode';

    lockCheckbox.setState(enabled);
    enableInputsMenuItem.setState(enabled);
    popupLockItem.setState(!enabled);
    highlightMenuItem.setState(highlight);

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
