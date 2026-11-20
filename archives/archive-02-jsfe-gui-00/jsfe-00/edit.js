import {
  Model,
  Stage,
  Panel,
  Button,
  Label,
  Window,
  Frame,
  WindowEvent,
  MouseEvent,
  Controller,
  TextField,
  TextArea,
  Checkbox,
  FlowLayout,
  BorderLayout,
  MenuBar,
  Menu,
  MenuItem,
  CheckboxMenuItem,
  MenuShortcut,
  Themes
} from './awt.js';
import {
  SWEETIE_16,
  sweetieDarkTheme,
  sweetieLightTheme,
  applySweetieThemes
} from './sweetie.js';

// Register Sweetie-16 dark and light themes on AWT Themes
applySweetieThemes(Themes);

const DOS_16 = {
  black: '#000000',
  blue: '#0000aa',
  green: '#00aa00',
  cyan: '#00aaaa',
  red: '#aa0000',
  magenta: '#aa00aa',
  brown: '#aa5500',
  lightGray: '#aaaaaa',
  darkGray: '#555555',
  brightBlue: '#5555ff',
  brightGreen: '#55ff55',
  brightCyan: '#55ffff',
  brightRed: '#ff5555',
  brightMagenta: '#ff55ff',
  yellow: '#ffff55',
  white: '#ffffff'
};

// Enhance AWT theme palette with classic DOS-16 colors
Themes.dosBlue = {
  bg: DOS_16.black,
  panel: DOS_16.black,
  winTitle: DOS_16.black,
  winBody: DOS_16.black,
  btn: DOS_16.black,
  btnHover: DOS_16.blue,
  btnActive: DOS_16.darkGray,
  text: DOS_16.brightBlue,
  mutedText: DOS_16.blue,
  border: DOS_16.brightBlue,
  disabled: DOS_16.darkGray,
  scrollbarTrack: DOS_16.black,
  scrollbarThumb: DOS_16.brightBlue,
  scrollbarThumbHover: DOS_16.brightCyan,
  menuBar: DOS_16.black,
  menuBg: DOS_16.black,
  menuHighlight: DOS_16.blue,
  menuSeparator: DOS_16.darkGray
};

const SAMPLE_FILES = {
  'AUTOEXEC.BAT': [
    '@ECHO OFF',
    'PROMPT $P$G',
    'PATH C:\\DOS;C:\\AWT\\BIN;C:\\TOOLS',
    'SET TEMP=C:\\DOS\\TEMP',
    'LH MOUSE.COM',
    'ECHO MS-DOS EDIT Clone Ready!'
  ].join('\n'),
  'CONFIG.SYS': [
    'DEVICE=C:\\DOS\\HIMEM.SYS',
    'DOS=HIGH,UMB',
    'FILES=40',
    'BUFFERS=30',
    'LASTDRIVE=Z'
  ].join('\n'),
  'README.TXT': [
    'MS-DOS EDIT.COM CLONE (awt.js)',
    '==============================',
    '- Use File / Edit / Search / Options menus',
    '- Drag or resize the Frame as usual',
    '- Find Next searches from current caret position'
  ].join('\n')
};

const canvas = document.getElementById('myCanvas');
const stage = new Stage(canvas);

// Application State Model
// themeMode options: 'dosBlue' | 'sweetieDark' | 'sweetieLight'
const model = new Model({
  fileName: 'UNTITLED.TXT',
  modified: false,
  themeMode: 'dosBlue',
  showStatusBar: true,
  scrollbarsMode: TextArea.SCROLLBARS_BOTH,
  clipboard: '',
  lastSearch: '',
  statusMessage: 'F1=Help  Alt/Click Menus  Ctrl+F=Find',
  line: 1,
  col: 1
});

// Main DOS EDIT Frame
const editFrame = new Frame('MS-DOS Editor - UNTITLED.TXT', 12, 12, 576, 376, new BorderLayout(0, 0));

// MenuBar Setup
const menuBar = new MenuBar();

// --- FILE MENU ---
const fileMenu = new Menu('File');
const newMenuItem = new MenuItem('New', new MenuShortcut('n'), () => {
  requestActionWithDirtyCheck(() => {
    createNewDocument();
  });
});

const openMenuItem = new MenuItem('Open...', new MenuShortcut('o'), () => {
  requestActionWithDirtyCheck(() => {
    openFileDialog();
  });
});

const saveMenuItem = new MenuItem('Save', new MenuShortcut('s'), () => {
  saveCurrentDocument(false);
});

const saveAsMenuItem = new MenuItem('Save As...', null, () => {
  saveCurrentDocument(true);
});

const exitMenuItem = new MenuItem('Exit', new MenuShortcut('q'), () => {
  requestActionWithDirtyCheck(() => {
    editFrame.dispose();
    model.set('statusMessage', 'Editor closed.');
  });
});

fileMenu.add(newMenuItem);
fileMenu.add(openMenuItem);
fileMenu.add(saveMenuItem);
fileMenu.add(saveAsMenuItem);
fileMenu.addSeparator();
fileMenu.add(exitMenuItem);

// --- EDIT MENU ---
const editMenu = new Menu('Edit');
const cutMenuItem = new MenuItem('Cut', new MenuShortcut('x'), () => {
  const sel = editorArea.getSelectedText();
  if (sel.length > 0) {
    model.set('clipboard', sel);
    editorArea.replaceRange('', editorArea.getSelectionStart(), editorArea.getSelectionEnd());
    markModified('Cut selection to clipboard.');
  } else {
    model.set('statusMessage', 'Nothing selected to Cut.');
  }
});

const copyMenuItem = new MenuItem('Copy', new MenuShortcut('c'), () => {
  const sel = editorArea.getSelectedText();
  if (sel.length > 0) {
    model.set('clipboard', sel);
    model.set('statusMessage', `Copied ${sel.length} char(s) to clipboard.`);
  } else {
    model.set('statusMessage', 'Nothing selected to Copy.');
  }
});

const pasteMenuItem = new MenuItem('Paste', new MenuShortcut('v'), () => {
  const clip = model.get('clipboard');
  if (clip) {
    const start = editorArea.getSelectionStart();
    const end = editorArea.getSelectionEnd();
    editorArea.replaceRange(clip, start, end);
    markModified(`Pasted ${clip.length} char(s).`);
  } else {
    model.set('statusMessage', 'Clipboard is empty.');
  }
});

const clearMenuItem = new MenuItem('Clear', null, () => {
  const start = editorArea.getSelectionStart();
  const end = editorArea.getSelectionEnd();
  if (start !== end) {
    editorArea.replaceRange('', start, end);
    markModified('Cleared selection.');
  } else {
    editorArea.setText('');
    markModified('Cleared document.');
  }
});

const selectAllMenuItem = new MenuItem('Select All', new MenuShortcut('a'), () => {
  editorArea.selectAll();
  updateCursorStats();
  model.set('statusMessage', 'Selected entire document.');
});

editMenu.add(cutMenuItem);
editMenu.add(copyMenuItem);
editMenu.add(pasteMenuItem);
editMenu.add(clearMenuItem);
editMenu.addSeparator();
editMenu.add(selectAllMenuItem);

// --- SEARCH MENU ---
const searchMenu = new Menu('Search');
const findMenuItem = new MenuItem('Find...', new MenuShortcut('f'), () => {
  openFindDialog();
});

const findNextMenuItem = new MenuItem('Find Next', new MenuShortcut('g'), () => {
  findNextOccurrence(model.get('lastSearch'));
});

searchMenu.add(findMenuItem);
searchMenu.add(findNextMenuItem);

// --- OPTIONS MENU ---
const optionsMenu = new Menu('Options');
let dosThemeItem;
let sweetieDarkItem;
let sweetieLightItem;

function setThemeMode(mode, labelText) {
  model.set('themeMode', mode);
  model.set('statusMessage', `Theme: ${labelText}`);
}

dosThemeItem = new CheckboxMenuItem('DOS Blue Theme', true, null, (evt) => {
  if (evt.stateChange === 1) {
    setThemeMode('dosBlue', 'DOS Blue');
  } else if (model.get('themeMode') === 'dosBlue') {
    setThemeMode('sweetieDark', 'Sweetie-16 Dark');
  }
});

sweetieDarkItem = new CheckboxMenuItem('Sweetie-16 Dark', false, null, (evt) => {
  if (evt.stateChange === 1) {
    setThemeMode('sweetieDark', 'Sweetie-16 Dark');
  } else if (model.get('themeMode') === 'sweetieDark') {
    setThemeMode('sweetieLight', 'Sweetie-16 Light');
  }
});

sweetieLightItem = new CheckboxMenuItem('Sweetie-16 Light', false, null, (evt) => {
  if (evt.stateChange === 1) {
    setThemeMode('sweetieLight', 'Sweetie-16 Light');
  } else if (model.get('themeMode') === 'sweetieLight') {
    setThemeMode('dosBlue', 'DOS Blue');
  }
});

const statusBarItem = new CheckboxMenuItem('Show Status Bar', true, null, (evt) => {
  model.set('showStatusBar', evt.stateChange === 1);
});

const bothScrollbarsItem = new CheckboxMenuItem('Both Scrollbars', true, null, (evt) => {
  const nextMode = evt.stateChange === 1 ? TextArea.SCROLLBARS_BOTH : TextArea.SCROLLBARS_VERTICAL_ONLY;
  editorArea.scrollbarVisibility = nextMode;
  model.set('scrollbarsMode', nextMode);
  editorArea.invalidate();
  editorArea.repaint();
  model.set('statusMessage', nextMode === TextArea.SCROLLBARS_BOTH ? 'Scrollbars: Both' : 'Scrollbars: Vertical Only');
});

optionsMenu.add(dosThemeItem);
optionsMenu.add(sweetieDarkItem);
optionsMenu.add(sweetieLightItem);
optionsMenu.addSeparator();
optionsMenu.add(statusBarItem);
optionsMenu.add(bothScrollbarsItem);

menuBar.add(fileMenu);
menuBar.add(editMenu);
menuBar.add(searchMenu);
menuBar.add(optionsMenu);
editFrame.setMenuBar(menuBar);

// Main Editor TextArea
const editorArea = new TextArea(SAMPLE_FILES['AUTOEXEC.BAT'], 14, 64, TextArea.SCROLLBARS_BOTH);
editorArea.lineHeight = 18;
editorArea.addTextListener(() => {
  if (!model.get('modified')) {
    model.set('modified', true);
  }
  updateCursorStats();
});

editorArea.addMouseListener((evt) => {
  if (
    evt.id === MouseEvent.MOUSE_PRESSED ||
    evt.id === MouseEvent.MOUSE_DRAGGED ||
    evt.id === MouseEvent.MOUSE_CLICKED
  ) {
    updateCursorStats();
  }
});

editorArea.addKeyListener(() => {
  updateCursorStats();
});

// Status Bar Panel at SOUTH of Frame
const statusBar = new Panel(0, 0, 560, 24, new BorderLayout(6, 0));
const statusMsgLabel = new Label(0, 0, model.get('statusMessage'), Label.LEFT);
const cursorPosLabel = new Label(0, 0, 'Line: 0001  Col: 001', Label.RIGHT);
cursorPosLabel.setSize(150, 20);
statusBar.add(statusMsgLabel, BorderLayout.CENTER);
statusBar.add(cursorPosLabel, BorderLayout.EAST);

editFrame.add(editorArea, BorderLayout.CENTER);
editFrame.add(statusBar, BorderLayout.SOUTH);

editFrame.addWindowListener((e) => {
  if (e.id === WindowEvent.WINDOW_CLOSING) {
    if (model.get('modified')) {
      e.consume();
      requestActionWithDirtyCheck(() => {
        editFrame.dispose();
      });
    }
  }
});

stage.add(editFrame);

// Virtual File Storage in localStorage + built-in samples
const STORAGE_PREFIX = 'awt_dos_edit_v1:';

function listSavedFiles() {
  const names = new Set(Object.keys(SAMPLE_FILES));
  names.add(model.get('fileName'));
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) {
        names.add(k.slice(STORAGE_PREFIX.length));
      }
    }
  }
  return Array.from(names);
}

function readFileContent(name) {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_PREFIX + name);
    if (saved !== null) return saved;
  }
  return SAMPLE_FILES[name] ?? '';
}

function writeFileContent(name, content) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_PREFIX + name, content);
  }
  SAMPLE_FILES[name] = content;
}

function updateCursorStats() {
  const pos = editorArea.getCaretPosition();
  const before = editorArea.getText().slice(0, pos);
  const lines = before.split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  model.set('line', line);
  model.set('col', col);
}

function markModified(msg) {
  model.set('modified', true);
  if (msg) model.set('statusMessage', msg);
  updateCursorStats();
}

function createNewDocument() {
  editorArea.setText('');
  editorArea.setCaretPosition(0);
  model.set('fileName', 'UNTITLED.TXT');
  model.set('modified', false);
  model.set('statusMessage', 'New file created.');
  updateCursorStats();
}

function openDocumentByName(name) {
  const cleanName = (name || 'UNTITLED.TXT').trim().toUpperCase() || 'UNTITLED.TXT';
  const content = readFileContent(cleanName);
  editorArea.setText(content);
  editorArea.setCaretPosition(0);
  model.set('fileName', cleanName);
  model.set('modified', false);
  model.set('statusMessage', `Opened ${cleanName}`);
  updateCursorStats();
}

function saveCurrentDocument(forcePrompt) {
  const currentName = model.get('fileName');
  if (forcePrompt || currentName === 'UNTITLED.TXT') {
    openSaveAsDialog(currentName);
    return;
  }
  writeFileContent(currentName, editorArea.getText());
  model.set('modified', false);
  model.set('statusMessage', `Saved ${currentName}`);
}

function findNextOccurrence(query) {
  const needle = String(query ?? '');
  if (!needle) {
    openFindDialog();
    return;
  }
  model.set('lastSearch', needle);
  const hay = editorArea.getText();
  const searchFrom = editorArea.getSelectionEnd();
  let idx = hay.indexOf(needle, searchFrom);
  let wrapped = false;

  if (idx === -1 && searchFrom > 0) {
    idx = hay.indexOf(needle, 0);
    wrapped = idx !== -1;
  }

  if (idx !== -1) {
    editorArea.select(idx, idx + needle.length);
    editorArea.requestFocus();
    updateCursorStats();
    model.set(
      'statusMessage',
      wrapped ? `Found "${needle}" (wrapped to top)` : `Found "${needle}"`
    );
  } else {
    model.set('statusMessage', `Match not found: "${needle}"`);
  }
}

// Modal Dialog Helpers using Frame/Window
let activeDialog = null;

function closeActiveDialog() {
  if (activeDialog) {
    const dlg = activeDialog;
    activeDialog = null;
    dlg.dispose();
    editorArea.requestFocus();
  }
}

function showDialog(title, w, h, buildFn) {
  closeActiveDialog();
  const x = Math.max(20, Math.floor((canvas.width - w) / 2));
  const y = Math.max(20, Math.floor((canvas.height - h) / 2));
  const dlg = new Frame(title, x, y, w, h, null);
  dlg.setResizable(false);
  dlg.setAlwaysOnTop(true);
  dlg.addWindowListener((e) => {
    if (e.id === WindowEvent.WINDOW_CLOSING) {
      activeDialog = null;
    }
  });
  buildFn(dlg);
  activeDialog = dlg;
  stage.add(dlg);
  dlg.toFront();
  return dlg;
}

function requestActionWithDirtyCheck(onProceed) {
  if (!model.get('modified')) {
    onProceed();
    return;
  }
  showDialog('Unsaved Changes', 320, 148, (dlg) => {
    const msg = new Label(14, 38, `Save changes to ${model.get('fileName')}?`);
    msg.setSize(290, 22);
    dlg.add(msg);

    const btnRow = new Panel(10, 82, 300, 42, new FlowLayout(FlowLayout.CENTER, 8, 6));
    const saveBtn = new Button(0, 0, 82, 28, 'Yes', () => {
      const name = model.get('fileName');
      if (name === 'UNTITLED.TXT') {
        closeActiveDialog();
        openSaveAsDialog(name, onProceed);
      } else {
        writeFileContent(name, editorArea.getText());
        model.set('modified', false);
        closeActiveDialog();
        onProceed();
      }
    });
    const noBtn = new Button(0, 0, 82, 28, 'No', () => {
      model.set('modified', false);
      closeActiveDialog();
      onProceed();
    });
    const cancelBtn = new Button(0, 0, 82, 28, 'Cancel', () => {
      closeActiveDialog();
    });

    btnRow.add(saveBtn);
    btnRow.add(noBtn);
    btnRow.add(cancelBtn);
    dlg.add(btnRow);
  });
}

function openFileDialog() {
  const files = listSavedFiles();
  showDialog('Open File', 340, 196, (dlg) => {
    const lbl = new Label(14, 36, 'File Name (or click a sample below):');
    lbl.setSize(305, 20);
    dlg.add(lbl);

    const nameInput = new TextField(14, 58, 310, 26, files[0] || 'AUTOEXEC.BAT');
    dlg.add(nameInput);

    const quickRow = new Panel(14, 92, 310, 36, new FlowLayout(FlowLayout.LEFT, 6, 4));
    files.slice(0, 3).forEach((fname) => {
      const chip = new Button(0, 0, 96, 26, fname, () => {
        nameInput.setText(fname);
      });
      quickRow.add(chip);
    });
    dlg.add(quickRow);

    const actionRow = new Panel(14, 138, 310, 40, new FlowLayout(FlowLayout.RIGHT, 8, 4));
    const okBtn = new Button(0, 0, 86, 28, 'Open', () => {
      const chosen = nameInput.getText();
      closeActiveDialog();
      openDocumentByName(chosen);
    });
    const cancelBtn = new Button(0, 0, 86, 28, 'Cancel', () => {
      closeActiveDialog();
    });
    nameInput.addActionListener(() => okBtn.fireActionEvent('Open'));

    actionRow.add(okBtn);
    actionRow.add(cancelBtn);
    dlg.add(actionRow);
    nameInput.requestFocus();
  });
}

function openSaveAsDialog(defaultName, afterSave = null) {
  showDialog('Save File As', 340, 158, (dlg) => {
    const lbl = new Label(14, 38, 'Save as file name:');
    lbl.setSize(305, 20);
    dlg.add(lbl);

    const nameInput = new TextField(14, 62, 310, 26, defaultName || 'MYFILE.TXT');
    dlg.add(nameInput);

    const actionRow = new Panel(14, 102, 310, 40, new FlowLayout(FlowLayout.RIGHT, 8, 4));
    const saveBtn = new Button(0, 0, 86, 28, 'Save', () => {
      const cleanName = (nameInput.getText() || 'MYFILE.TXT').trim().toUpperCase() || 'MYFILE.TXT';
      writeFileContent(cleanName, editorArea.getText());
      model.set('fileName', cleanName);
      model.set('modified', false);
      model.set('statusMessage', `Saved ${cleanName}`);
      closeActiveDialog();
      if (typeof afterSave === 'function') afterSave();
    });
    const cancelBtn = new Button(0, 0, 86, 28, 'Cancel', () => {
      closeActiveDialog();
    });
    nameInput.addActionListener(() => saveBtn.fireActionEvent('Save'));

    actionRow.add(saveBtn);
    actionRow.add(cancelBtn);
    dlg.add(actionRow);
    nameInput.requestFocus();
  });
}

function openFindDialog() {
  showDialog('Find', 340, 158, (dlg) => {
    const lbl = new Label(14, 38, 'Find What:');
    lbl.setSize(305, 20);
    dlg.add(lbl);

    const findInput = new TextField(14, 62, 310, 26, model.get('lastSearch') || '');
    dlg.add(findInput);

    const actionRow = new Panel(14, 102, 310, 40, new FlowLayout(FlowLayout.RIGHT, 8, 4));
    const findBtn = new Button(0, 0, 92, 28, 'Find Next', () => {
      const term = findInput.getText();
      closeActiveDialog();
      findNextOccurrence(term);
    });
    const cancelBtn = new Button(0, 0, 86, 28, 'Cancel', () => {
      closeActiveDialog();
    });
    findInput.addActionListener(() => findBtn.fireActionEvent('Find Next'));

    actionRow.add(findBtn);
    actionRow.add(cancelBtn);
    dlg.add(actionRow);
    findInput.requestFocus();
  });
}

// Controller binding Model -> View
class DosEditController extends Controller {
  updateView() {
    const fileName = this.model.get('fileName');
    const modified = this.model.get('modified');
    const themeMode = this.model.get('themeMode') || 'dosBlue';
    const showStatusBar = this.model.get('showStatusBar');
    const statusMessage = this.model.get('statusMessage');
    const line = this.model.get('line');
    const col = this.model.get('col');

    const dirtyMark = modified ? '*' : '';
    editFrame.setTitle(`MS-DOS Editor - ${fileName}${dirtyMark}`);
    statusMsgLabel.setText(statusMessage);
    cursorPosLabel.setText(`Line: ${String(line).padStart(4, '0')}  Col: ${String(col).padStart(3, '0')}`);

    statusBar.setVisible(showStatusBar);
    editFrame.invalidate();

    dosThemeItem.setState(themeMode === 'dosBlue');
    sweetieDarkItem.setState(themeMode === 'sweetieDark');
    sweetieLightItem.setState(themeMode === 'sweetieLight');
    statusBarItem.setState(showStatusBar);
    bothScrollbarsItem.setState(this.model.get('scrollbarsMode') === TextArea.SCROLLBARS_BOTH);

    const activeThemeName = Themes[themeMode] ? themeMode : 'dosBlue';
    this.stage.setTheme(activeThemeName);

    if (typeof document !== 'undefined' && document.body) {
      if (activeThemeName === 'sweetieDark') {
        document.body.style.backgroundColor = sweetieDarkTheme.bg;
        document.body.style.color = sweetieDarkTheme.text;
      } else if (activeThemeName === 'sweetieLight') {
        document.body.style.backgroundColor = sweetieLightTheme.bg;
        document.body.style.color = sweetieLightTheme.text;
			} else {
        document.body.style.backgroundColor = SWEETIE_16.licorice;
        document.body.style.color = SWEETIE_16.cottonCandy;
      }
    }
  }
}

const controller = new DosEditController(model, editFrame, stage);
controller.updateView();
updateCursorStats();
editorArea.requestFocus();
