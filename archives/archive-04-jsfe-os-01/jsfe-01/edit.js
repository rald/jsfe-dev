// Minimalist MS-DOS EDIT.COM Clone (MVC + Retained GUI + Sweetie-16 Dark Theme)

import {
  BaseModel,
  BaseView,
  BaseController,
  Command,
  CommandInvoker,
  GuiNodeFactory,
} from './gui.js';

// --- Model ---
export class EditorModel extends BaseModel {
  constructor() {
    super();
    this.fileName = 'UNTITLED.TXT';
    this.content = '';
    this.modified = false;
    this.line = 1;
    this.col = 1;
    this.lastSearch = '';
    this.statusMessage = 'Ready';
    this.activeMenu = null; // 'File' | 'Edit' | 'Search' | null
    this.dialog = null; // null | { type: 'open' | 'saveAs' | 'find' | 'about' | 'confirmExit', ... }
  }

  setContent(nextContent, { markModified = true, status = null } = {}) {
    this.content = String(nextContent);
    if (markModified) {
      this.modified = true;
    }
    this._recomputeCursorFromOffset(Math.min(this._offsetFromLineCol(this.line, this.col), this.content.length));
    if (status) {
      this.statusMessage = status;
    }
    this.emit('change', this.getSnapshot());
  }

  setCursorByOffset(offset) {
    const clamped = Math.max(0, Math.min(offset, this.content.length));
    this._recomputeCursorFromOffset(clamped);
    this.emit('cursor', this.getSnapshot());
  }

  _recomputeCursorFromOffset(offset) {
    const slice = this.content.slice(0, offset);
    const lines = slice.split('\n');
    this.line = lines.length;
    this.col = lines[lines.length - 1].length + 1;
  }

  _offsetFromLineCol(targetLine, targetCol) {
    const lines = this.content.split('\n');
    const safeLine = Math.max(1, Math.min(targetLine, lines.length));
    let offset = 0;
    for (let i = 0; i < safeLine - 1; i++) {
      offset += lines[i].length + 1;
    }
    const safeCol = Math.max(1, Math.min(targetCol, lines[safeLine - 1].length + 1));
    return offset + (safeCol - 1);
  }

  newDocument() {
    this.fileName = 'UNTITLED.TXT';
    this.content = '';
    this.modified = false;
    this.line = 1;
    this.col = 1;
    this.statusMessage = 'New file created';
    this.emit('document', this.getSnapshot());
    this.emit('change', this.getSnapshot());
  }

  openDocument(name, text) {
    this.fileName = (name || 'UNTITLED.TXT').trim().toUpperCase();
    this.content = String(text);
    this.modified = false;
    this.line = 1;
    this.col = 1;
    this.statusMessage = `Loaded ${this.fileName}`;
    this.emit('document', this.getSnapshot());
    this.emit('change', this.getSnapshot());
  }

  saveDocument(customName = null) {
    if (customName && customName.trim()) {
      this.fileName = customName.trim().toUpperCase();
    }
    this.modified = false;
    this.statusMessage = `Saved ${this.fileName}`;
    this.emit('save', this.getSnapshot());
    this.emit('change', this.getSnapshot());
  }

  setMenu(menuName) {
    this.activeMenu = this.activeMenu === menuName ? null : menuName;
    this.emit('menu', this.getSnapshot());
  }

  closeMenu() {
    if (this.activeMenu !== null) {
      this.activeMenu = null;
      this.emit('menu', this.getSnapshot());
    }
  }

  openDialog(dialogSpec) {
    this.activeMenu = null;
    this.dialog = dialogSpec;
    this.emit('dialog', this.getSnapshot());
  }

  closeDialog() {
    if (this.dialog !== null) {
      this.dialog = null;
      this.emit('dialog', this.getSnapshot());
    }
  }

  setStatus(msg) {
    this.statusMessage = msg;
    this.emit('status', this.getSnapshot());
  }

  getSnapshot() {
    const lines = this.content.split('\n');
    return {
      fileName: this.fileName,
      content: this.content,
      modified: this.modified,
      line: this.line,
      col: this.col,
      lineCount: lines.length,
      lastSearch: this.lastSearch,
      statusMessage: this.statusMessage,
      activeMenu: this.activeMenu,
      dialog: this.dialog ? { ...this.dialog } : null,
    };
  }
}

// --- Commands (Command Pattern) ---
class NewFileCommand extends Command {
  constructor(model) {
    super();
    this.model = model;
  }

  execute() {
    this.model.newDocument();
  }
}

class SaveFileCommand extends Command {
  constructor(model, name = null) {
    super();
    this.model = model;
    this.name = name;
  }

  execute() {
    this.model.saveDocument(this.name);
  }
}

class FindTextCommand extends Command {
  constructor(model, view, query, fromOffset = 0) {
    super();
    this.model = model;
    this.view = view;
    this.query = query;
    this.fromOffset = fromOffset;
  }

  execute() {
    if (!this.query) {
      this.model.setStatus('Find string is empty');
      return false;
    }
    this.model.lastSearch = this.query;
    const haystack = this.model.content;
    let idx = haystack.indexOf(this.query, this.fromOffset);
    if (idx === -1 && this.fromOffset > 0) {
      idx = haystack.indexOf(this.query, 0);
    }
    if (idx === -1) {
      this.model.setStatus(`Match not found: "${this.query}"`);
      return false;
    }
    this.model.setCursorByOffset(idx);
    this.view.selectRange(idx, idx + this.query.length);
    this.model.setStatus(`Found "${this.query}" at Ln ${this.model.line}, Col ${this.model.col}`);
    return true;
  }
}

// --- View (Retained GUI Tree) ---
export class EditorView extends BaseView {
  constructor(rootContainer) {
    super(rootContainer);
    this.nodes = {};
    this._menuBarNode = null;
    this._dropdownNode = null;
    this._dialogNode = null;
    this._dialogInput = null;
    this._dialogTitle = null;
    this._dialogMessage = null;
  }

  buildRetainedTree() {
    this.rootNode.clearChildren();

    // Outer DOS Window Frame
    const frame = GuiNodeFactory.create('panel', 'dos-frame', { className: 'dos-frame' });

    // Top Menu Bar
    const menuBar = GuiNodeFactory.create('panel', 'dos-menubar', { className: 'dos-menubar' });
    this._menuBarNode = menuBar;

    const menus = ['File', 'Edit', 'Search'];
    for (const name of menus) {
      const btn = GuiNodeFactory.create('button', `menu-btn-${name.toLowerCase()}`, name, {
        className: 'dos-menu-btn',
        onClick: (ev) => {
          ev.stopPropagation();
          this.emit('menuToggle', name);
        },
      });
      this.nodes[`menu_${name}`] = btn;
      menuBar.add(btn);
    }

    const titleLabel = GuiNodeFactory.create('label', 'dos-title', 'EDIT', {
      className: 'dos-title',
    });
    this.nodes.title = titleLabel;
    menuBar.add(titleLabel);

    // Dropdown Menu Container (Retained)
    const dropdown = GuiNodeFactory.create('panel', 'dos-dropdown', {
      className: 'dos-dropdown',
    });
    dropdown.setVisible(false);
    this._dropdownNode = dropdown;

    // Editor Body (Line Gutter + Text Area)
    const editorBody = GuiNodeFactory.create('panel', 'dos-editor-body', {
      className: 'dos-editor-body',
    });

    const gutter = GuiNodeFactory.create('label', 'dos-gutter', '1', {
      className: 'dos-gutter',
    });
    this.nodes.gutter = gutter;

    const textarea = GuiNodeFactory.create('textarea', 'dos-textarea', '', {
      className: 'dos-textarea',
      spellcheck: false,
      wrap: 'off',
    });
    textarea.on('input', (payload) => this.emit('textInput', payload));
    textarea.on('cursor', (payload) => this.emit('cursorMove', payload));
    textarea.on('scroll', (payload) => this.emit('editorScroll', payload));
    textarea.on('keydown', (ev) => this.emit('editorKeydown', ev));
    this.nodes.textarea = textarea;

    editorBody.add(gutter);
    editorBody.add(textarea);

    // Bottom Status Bar (MS-DOS EDIT style)
    const statusBar = GuiNodeFactory.create('panel', 'dos-statusbar', {
      className: 'dos-statusbar',
    });

    const statusMsg = GuiNodeFactory.create('label', 'dos-status-msg', 'Ready', {
      className: 'dos-status-msg',
    });
    this.nodes.statusMsg = statusMsg;

    const cursorPos = GuiNodeFactory.create('label', 'dos-cursor-pos', 'Line:1    Col:1', {
      className: 'dos-cursor-pos',
    });
    this.nodes.cursorPos = cursorPos;

    statusBar.add(statusMsg);
    statusBar.add(cursorPos);

    // Modal Dialog Overlay (Retained)
    const dialogOverlay = GuiNodeFactory.create('panel', 'dos-dialog-overlay', {
      className: 'dos-dialog-overlay',
    });
    dialogOverlay.setVisible(false);
    this._dialogNode = dialogOverlay;

    const dialogBox = GuiNodeFactory.create('panel', 'dos-dialog-box', {
      className: 'dos-dialog-box',
    });

    this._dialogTitle = GuiNodeFactory.create('label', 'dos-dialog-title', 'DIALOG', {
      className: 'dos-dialog-title',
    });
    this._dialogMessage = GuiNodeFactory.create('label', 'dos-dialog-msg', '', {
      className: 'dos-dialog-msg',
    });
    this._dialogInput = GuiNodeFactory.create('input', 'dos-dialog-input', '', {
      className: 'dos-dialog-input',
    });

    const dialogActions = GuiNodeFactory.create('panel', 'dos-dialog-actions', {
      className: 'dos-dialog-actions',
    });

    const okBtn = GuiNodeFactory.create('button', 'dos-dialog-ok', 'OK', {
      className: 'dos-btn dos-btn-primary',
      onClick: () => {
        this.emit('dialogConfirm', {
          value: this._dialogInput.getValue(),
        });
      },
    });

    const cancelBtn = GuiNodeFactory.create('button', 'dos-dialog-cancel', 'Cancel', {
      className: 'dos-btn',
      onClick: () => {
        this.emit('dialogCancel');
      },
    });

    this._dialogInput.on('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this.emit('dialogConfirm', { value: this._dialogInput.getValue() });
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        this.emit('dialogCancel');
      }
    });

    dialogActions.add(okBtn);
    dialogActions.add(cancelBtn);

    dialogBox.add(this._dialogTitle);
    dialogBox.add(this._dialogMessage);
    dialogBox.add(this._dialogInput);
    dialogBox.add(dialogActions);
    dialogOverlay.add(dialogBox);

    frame.add(menuBar);
    frame.add(dropdown);
    frame.add(editorBody);
    frame.add(statusBar);
    frame.add(dialogOverlay);

    this.rootNode.add(frame);
  }

  updateFromState(state) {
    const dirtyFlag = state.modified ? '*' : ' ';
    this.nodes.title.setText(`${state.fileName}${dirtyFlag}`);

    for (const [name, btn] of Object.entries(this.nodes)) {
      if (name.startsWith('menu_')) {
        const menuKey = name.slice(5);
        const isActive = state.activeMenu === menuKey;
        btn.className = isActive ? 'dos-menu-btn is-active' : 'dos-menu-btn';
        btn.markDirty();
      }
    }

    this._rebuildDropdown(state.activeMenu);

    if (this.nodes.textarea.getValue() !== state.content) {
      this.nodes.textarea.setValue(state.content);
    }

    this._updateGutter(state.lineCount, state.line);
    this.nodes.statusMsg.setText(state.statusMessage);
    this.nodes.cursorPos.setText(`Line:${String(state.line).padEnd(4, ' ')}Col:${state.col}`);

    this._updateDialog(state.dialog);
    this.scheduleRender();
  }

  _rebuildDropdown(activeMenu) {
    this._dropdownNode.clearChildren();
    if (!activeMenu) {
      this._dropdownNode.setVisible(false);
      return;
    }

    const itemsByMenu = {
      File: [
        { id: 'new', label: 'New' },
        { id: 'open', label: 'Open...' },
        { id: 'save', label: 'Save' },
        { id: 'saveAs', label: 'Save As...' },
        { id: 'about', label: 'About' },
        { id: 'exit', label: 'Exit' },
      ],
      Edit: [
        { id: 'cut', label: 'Cut' },
        { id: 'copy', label: 'Copy' },
        { id: 'paste', label: 'Paste' },
        { id: 'selectAll', label: 'Select All' },
      ],
      Search: [
        { id: 'find', label: 'Find...' },
        { id: 'findNext', label: 'Repeat Last Find' },
      ],
    };

    const leftOffsets = { File: 8, Edit: 64, Search: 120 };
    if (this._dropdownNode.el) {
      this._dropdownNode.el.style.left = `${leftOffsets[activeMenu] ?? 8}px`;
    }

    const entries = itemsByMenu[activeMenu] || [];
    for (const item of entries) {
      const itemBtn = GuiNodeFactory.create('button', `dd-${item.id}`, item.label, {
        className: 'dos-dropdown-item',
        onClick: (ev) => {
          ev.stopPropagation();
          this.emit('menuAction', item.id);
        },
      });
      this._dropdownNode.add(itemBtn);
    }

    this._dropdownNode.setVisible(true);
  }

  _updateGutter(lineCount, currentLine) {
    const total = Math.max(1, lineCount);
    const width = String(total).length;
    const lines = [];
    for (let i = 1; i <= total; i++) {
      const num = String(i).padStart(width, ' ');
      lines.push(i === currentLine ? `>${num}` : ` ${num}`);
    }
    this.nodes.gutter.setText(lines.join('\n'));
  }

  _updateDialog(dialog) {
    if (!dialog) {
      this._dialogNode.setVisible(false);
      return;
    }

    this._dialogTitle.setText(dialog.title || 'DIALOG');
    this._dialogMessage.setText(dialog.message || '');

    if (dialog.hasInput) {
      this._dialogInput.setVisible(true);
      this._dialogInput.setValue(dialog.initialValue || '');
    } else {
      this._dialogInput.setVisible(false);
    }

    this._dialogNode.setVisible(true);
    if (dialog.hasInput) {
      setTimeout(() => this._dialogInput.focus(), 0);
    }
  }

  syncGutterScroll(scrollTop) {
    if (this.nodes.gutter && this.nodes.gutter.el) {
      this.nodes.gutter.el.scrollTop = scrollTop;
    }
  }

  selectRange(start, end) {
    this.nodes.textarea.focus();
    this.nodes.textarea.setSelectionRange(start, end);
  }

  getSelection() {
    return this.nodes.textarea.getSelection();
  }

  focusEditor() {
    this.nodes.textarea.focus();
  }
}

// --- Controller ---
export class EditorController extends BaseController {
  constructor(model, view, invoker = new CommandInvoker()) {
    super(model, view, invoker);
    this._clipboardText = '';
    this._filePickerEl = null;
  }

  bind() {
    this._setupHiddenFilePicker();

    const syncView = () => this.view.updateFromState(this.model.getSnapshot());
    this.model.on('change', syncView);
    this.model.on('cursor', syncView);
    this.model.on('menu', syncView);
    this.model.on('dialog', syncView);
    this.model.on('status', syncView);
    this.model.on('document', syncView);
    this.model.on('save', (snap) => this._triggerDownload(snap.fileName, snap.content));

    this.view.on('menuToggle', (menuName) => {
      this.model.setMenu(menuName);
    });

    this.view.on('menuAction', (actionId) => {
      this._handleMenuAction(actionId);
    });

    this.view.on('textInput', ({ value, selectionStart }) => {
      this.model.content = value;
      this.model.modified = true;
      this.model._recomputeCursorFromOffset(selectionStart);
      this.model.statusMessage = 'Editing';
      this.model.emit('change', this.model.getSnapshot());
    });

    this.view.on('cursorMove', ({ selectionStart }) => {
      this.model.setCursorByOffset(selectionStart);
    });

    this.view.on('editorScroll', ({ scrollTop }) => {
      this.view.syncGutterScroll(scrollTop);
    });

    this.view.on('editorKeydown', (ev) => {
      if (ev.key === 'Tab') {
        ev.preventDefault();
        const { start, end } = this.view.getSelection();
        const before = this.model.content.slice(0, start);
        const after = this.model.content.slice(end);
        const tabSpaces = '  ';
        const nextVal = before + tabSpaces + after;
        this.model.content = nextVal;
        this.model.modified = true;
        this.model._recomputeCursorFromOffset(start + tabSpaces.length);
        this.model.emit('change', this.model.getSnapshot());
        setTimeout(() => {
          this.view.selectRange(start + tabSpaces.length, start + tabSpaces.length);
        }, 0);
      } else if (ev.key === 'Escape') {
        this.model.closeMenu();
        this.model.closeDialog();
      }
    });

    this.view.on('dialogConfirm', ({ value }) => {
      const dlg = this.model.dialog;
      if (!dlg) return;
      if (dlg.type === 'saveAs') {
        this.model.closeDialog();
        this.invoker.run(new SaveFileCommand(this.model, value));
      } else if (dlg.type === 'find') {
        this.model.closeDialog();
        const startOffset = this.view.getSelection().end;
        this.invoker.run(new FindTextCommand(this.model, this.view, value, startOffset));
      } else if (dlg.type === 'confirmExit') {
        this.model.closeDialog();
        this.invoker.run(new NewFileCommand(this.model));
        this.model.setStatus('Session reset');
      } else {
        this.model.closeDialog();
      }
    });

    this.view.on('dialogCancel', () => {
      this.model.closeDialog();
      this.view.focusEditor();
    });

    const doc = this.view.rootContainer.ownerDocument || document;
    doc.addEventListener('click', (ev) => {
      const target = ev.target;
      if (!target || !target.closest) return;
      if (!target.closest('.dos-menubar') && !target.closest('.dos-dropdown')) {
        this.model.closeMenu();
      }
    });

    this.view.init();
    syncView();
  }

  _setupHiddenFilePicker() {
    const doc = this.view.rootContainer.ownerDocument || document;
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.js,.json,.log,.cfg,.bat,.bas,text/*';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.model.openDocument(file.name, String(reader.result ?? ''));
      };
      reader.readAsText(file);
      input.value = '';
    });
    doc.body.appendChild(input);
    this._filePickerEl = input;
  }

  _triggerDownload(fileName, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'UNTITLED.TXT';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  _handleMenuAction(actionId) {
    this.model.closeMenu();

    switch (actionId) {
      case 'new':
        this.invoker.run(new NewFileCommand(this.model));
        break;
      case 'open':
        if (this._filePickerEl) {
          this._filePickerEl.click();
        }
        break;
      case 'save':
        this.invoker.run(new SaveFileCommand(this.model));
        break;
      case 'saveAs':
        this.model.openDialog({
          type: 'saveAs',
          title: 'Save As',
          message: 'Enter file name:',
          hasInput: true,
          initialValue: this.model.fileName,
        });
        break;
      case 'about':
        this.model.openDialog({
          type: 'about',
          title: 'About EDIT',
          message: 'Minimalist DOS EDIT clone • Retained GUI • Sweetie-16 Dark Theme',
          hasInput: false,
        });
        break;
      case 'exit':
        if (this.model.modified) {
          this.model.openDialog({
            type: 'confirmExit',
            title: 'Unsaved Changes',
            message: 'Discard unsaved changes and start a fresh buffer?',
            hasInput: false,
          });
        } else {
          this.model.setStatus('Ready');
        }
        break;
      case 'cut': {
        const { start, end, text } = this.view.getSelection();
        if (start !== end) {
          this._clipboardText = text;
          const next = this.model.content.slice(0, start) + this.model.content.slice(end);
          this.model.content = next;
          this.model.modified = true;
          this.model._recomputeCursorFromOffset(start);
          this.model.statusMessage = 'Cut selection';
          this.model.emit('change', this.model.getSnapshot());
          setTimeout(() => this.view.selectRange(start, start), 0);
        }
        break;
      }
      case 'copy': {
        const { start, end, text } = this.view.getSelection();
        if (start !== end) {
          this._clipboardText = text;
          this.model.setStatus('Copied selection');
        }
        break;
      }
      case 'paste': {
        const { start, end } = this.view.getSelection();
        const next =
          this.model.content.slice(0, start) +
          this._clipboardText +
          this.model.content.slice(end);
        const caret = start + this._clipboardText.length;
        this.model.content = next;
        this.model.modified = true;
        this.model._recomputeCursorFromOffset(caret);
        this.model.statusMessage = 'Pasted text';
        this.model.emit('change', this.model.getSnapshot());
        setTimeout(() => this.view.selectRange(caret, caret), 0);
        break;
      }
      case 'selectAll': {
        this.view.selectRange(0, this.model.content.length);
        this.model.setStatus('Selected all');
        break;
      }
      case 'find':
        this.model.openDialog({
          type: 'find',
          title: 'Find',
          message: 'Text to find:',
          hasInput: true,
          initialValue: this.model.lastSearch,
        });
        break;
      case 'findNext': {
        const startOffset = this.view.getSelection().end;
        this.invoker.run(
          new FindTextCommand(this.model, this.view, this.model.lastSearch, startOffset)
        );
        break;
      }
      default:
        break;
    }
  }
}

export function createDosEditApp(container) {
  const model = new EditorModel();
  const view = new EditorView(container);
  const controller = new EditorController(model, view);
  controller.bind();
  return { model, view, controller };
}
