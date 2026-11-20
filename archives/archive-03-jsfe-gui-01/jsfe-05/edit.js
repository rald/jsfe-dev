import { GUI } from './src/gui.js';

/**
 * Minimal MS-DOS EDIT.COM clone built on gui.js (`TextArea`, `MenuBar`, `Menu`, `Dialog`, `Label`).
 */
export class EditApp {
  constructor(canvasSelectorOrEl, options = {}) {
    this.filename = options.filename ?? 'UNTITLED.TXT';
    this.clipboard = '';
    this.lastSearch = '';

    this.gui = new GUI(canvasSelectorOrEl, {
      clearColor: '#0000aa',
      ...options
    });

    const width = this.gui.renderer.logicalWidth || 800;
    const height = this.gui.renderer.logicalHeight || 520;
    const menuBarH = 26;
    const statusBarH = 24;

    // 1. Classic DOS-style MenuBar
    this.menuBar = this.gui.create('menubar', {
      x: 0,
      y: 0,
      width,
      height: menuBarH,
      theme: {
        bg: '#c0c0c0',
        border: '#808080',
        accent: '#0000aa',
        text: '#000000',
        radius: 0,
        font: '13px "Courier New", Courier, monospace'
      },
      menus: [
        {
          label: 'File',
          items: [
            {
              label: 'New',
              shortcut: 'Ctrl+N',
              onSelect: () => this.newFile()
            },
            {
              label: 'Open...',
              shortcut: 'Ctrl+O',
              onSelect: () => this.openDialog()
            },
            {
              label: 'Save',
              shortcut: 'Ctrl+S',
              onSelect: () => this.saveFile()
            },
            { separator: true },
            {
              label: 'Exit',
              shortcut: 'Alt+X',
              onSelect: () => this.exitApp()
            }
          ]
        },
        {
          label: 'Edit',
          items: [
            {
              label: 'Cut',
              shortcut: 'Shift+Del',
              onSelect: () => this.cutSelection()
            },
            {
              label: 'Copy',
              shortcut: 'Ctrl+Ins',
              onSelect: () => this.copySelection()
            },
            {
              label: 'Paste',
              shortcut: 'Shift+Ins',
              onSelect: () => this.pasteClipboard()
            },
            {
              label: 'Clear',
              onSelect: () => this.editor.model.deleteSelection()
            }
          ]
        },
        {
          label: 'Search',
          items: [
            {
              label: 'Find...',
              shortcut: 'Ctrl+F',
              onSelect: () => this.findDialog()
            },
            {
              label: 'Find Next',
              shortcut: 'F3',
              onSelect: () => this.findNext()
            }
          ]
        },
        {
          label: 'Options',
          items: [
            {
              label: 'Line Numbers',
              checked: true,
              onSelect: ({ model }) => {
                this.editor.model.set('showLineNumbers', model.get('checked'));
              }
            },
            {
              label: 'DOS Colors',
              checked: true,
              onSelect: ({ model }) => {
                const dos = model.get('checked');
                this.gui.renderer.clearColor = dos ? '#0000aa' : '#18191c';
                this.editor.model.set('theme', {
                  ...this.editor.model.get('theme'),
                  bg: dos ? '#0000aa' : '#18191c',
                  gutterBg: dos ? '#000080' : '#1e1f22',
                  text: dos ? '#ffffff' : '#e6e8ec'
                });
                this.gui.renderer.renderFrame();
              }
            }
          ]
        }
      ]
    });

    // Attach dropdown menus to scene graph
    for (const entry of this.menuBar._entries) {
      this.gui.add(entry.menu);
    }

    // 2. Main TextArea Editor Buffer
    const defaultContent = options.initialText ?? [
      'MS-DOS EDIT Clone (edit.js)',
      '----------------------------',
      'Click inside the blue buffer and start typing.',
      'Use File, Edit, Search, and Options menus above.'
    ].join('\n');

    this.editor = this.gui.create('textarea', {
      x: 0,
      y: menuBarH,
      width,
      height: height - menuBarH - statusBarH,
      text: defaultContent,
      showLineNumbers: true
    });

    // 3. Bottom Status Bar (filename + Line:Col indicator)
    this.statusBar = this.gui.create('panel', {
      x: 0,
      y: height - statusBarH,
      width,
      height: statusBarH,
      theme: {
        bg: '#00aaaa',
        border: '#008080',
        radius: 0
      }
    });

    this.fileLabel = this.gui.create('label', {
      x: 10,
      y: 2,
      width: 340,
      height: statusBarH - 4,
      text: `File: ${this.filename}`,
      theme: {
        text: '#000000',
        font: '12px "Courier New", Courier, monospace'
      }
    }, this.statusBar);

    this.cursorLabel = this.gui.create('label', {
      x: width - 170,
      y: 2,
      width: 160,
      height: statusBarH - 4,
      align: 'right',
      text: 'Line 1, Col 1',
      theme: {
        text: '#000000',
        font: '12px "Courier New", Courier, monospace'
      }
    }, this.statusBar);

    // 4. Modal Dialog for Open / Find / Alerts
    this.dialog = this.gui.create('dialog', {
      x: Math.round((width - 420) / 2),
      y: Math.round((height - 160) / 2),
      width: 420,
      height: 160,
      visible: false
    });

    this._bindEvents();
    this.gui.input._setFocus(this.editor);
    this.gui.renderer.renderFrame();
  }

  _bindEvents() {
    this.editor.on('cursor', ({ line, col }) => {
      const mod = this.editor.model.get('modified') ? '*' : '';
      this.fileLabel.setProps({ text: `File: ${this.filename}${mod}` });
      this.cursorLabel.setProps({ text: `Line ${line}, Col ${col}` });
    });

    this.editor.on('change:text', () => {
      const mod = this.editor.model.get('modified') ? '*' : '';
      this.fileLabel.setProps({ text: `File: ${this.filename}${mod}` });
    });
  }

  newFile() {
    this.filename = 'UNTITLED.TXT';
    this.editor.setText('', false);
    this.fileLabel.setProps({ text: `File: ${this.filename}` });
  }

  openDialog() {
    this.dialog.open({
      title: 'Open File',
      message: 'Enter filename or sample note title:',
      inputValue: 'README.TXT',
      hasInput: true,
      buttons: ['Open', 'Cancel']
    });

    const off = this.dialog.on('close', ({ result, value }) => {
      off();
      if (result === 'Open') {
        this.filename = (value || 'LOADED.TXT').toUpperCase();
        this.editor.setText(
          `Loaded ${this.filename}\n\nEdit this text freely using the keyboard or Edit/Search menus.`,
          false
        );
        this.fileLabel.setProps({ text: `File: ${this.filename}` });
      }
      this.gui.input._setFocus(this.editor);
    });
  }

  saveFile() {
    this.editor.model.set('modified', false);
    this.fileLabel.setProps({ text: `File: ${this.filename} [Saved]` });
  }

  cutSelection() {
    const selected = this.editor.model.getSelectedText();
    if (selected) {
      this.clipboard = selected;
      this.editor.model.deleteSelection();
    }
  }

  copySelection() {
    const selected = this.editor.model.getSelectedText();
    if (selected) {
      this.clipboard = selected;
    }
  }

  pasteClipboard() {
    if (this.clipboard) {
      this.editor.model.insertText(this.clipboard);
    }
  }

  findDialog() {
    this.dialog.open({
      title: 'Find Text',
      message: 'Find what:',
      inputValue: this.lastSearch,
      hasInput: true,
      buttons: ['Find', 'Cancel']
    });

    const off = this.dialog.on('close', ({ result, value }) => {
      off();
      if (result === 'Find' && value) {
        this.lastSearch = value;
        const found = this.editor.model.findAndSelect(value, 0, 0);
        if (!found) {
          this.fileLabel.setProps({ text: `File: ${this.filename} (Not found: "${value}")` });
        }
      }
      this.gui.input._setFocus(this.editor);
    });
  }

  findNext() {
    if (!this.lastSearch) {
      this.findDialog();
      return;
    }
    const line = this.editor.model.get('cursorLine');
    const col = this.editor.model.get('cursorCol');
    const found = this.editor.model.findAndSelect(this.lastSearch, line, col);
    if (!found) {
      this.editor.model.findAndSelect(this.lastSearch, 0, 0);
    }
  }

  exitApp() {
    this.dialog.open({
      title: 'Exit EDIT.COM',
      message: `Close editor session for ${this.filename}?`,
      hasInput: false,
      buttons: ['OK', 'Cancel']
    });

    const off = this.dialog.on('close', ({ result }) => {
      off();
      if (result === 'OK') {
        this.editor.setProps({ enabled: false });
        this.fileLabel.setProps({ text: 'Session terminated.' });
      }
      this.gui.input._setFocus(this.editor);
    });
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.querySelector('#edit-canvas');
    if (canvas) {
      window.editApp = new EditApp(canvas);
    }
  });
}
