import { GUI, TextArea, MenuBar, Panel, Label } from './src/gui.js';

export function initEditApp(canvasId = 'edit-canvas') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) throw new Error(`Canvas #${canvasId} not found`);

  const width = canvas.width || 800;
  const height = canvas.height || 600;

  const gui = new GUI(canvas, {
    clearColor: '#000080'
  });

  const menuBarH = 24;
  const statusBarH = 24;
  const lowerPaneH = 48;
  const editorY = menuBarH;
  const editorH = Math.max(120, height - menuBarH - statusBarH - lowerPaneH);
  const bottomAreaY = editorY + editorH;

  const menuBar = new MenuBar({ x: 0, y: 0, width, height: menuBarH });

  const fileMenu = menuBar.addMenu('File');
  const searchMenu = menuBar.addMenu('Search');
  const helpMenu = menuBar.addMenu('Help');

  let editor;
  let lowerInfoLabel;
  let statusLabel;

  const updateLowerInfo = () => {
    if (!editor || !lowerInfoLabel) return;
    const text = editor.getText();
    const lines = text.split('\n').length;
    const chars = text.length;
    const mod = editor.model.get('modified') ? 'Modified' : 'Saved';
    lowerInfoLabel.model.set('text', `Lines: ${lines}  |  Chars: ${chars}  |  Status: ${mod}`);
  };

  // File: Load, Save
  fileMenu.addItem('Load', () => {
    if (typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,.js,.json,.md,.csv,.log,*/*';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          editor.setText(String(reader.result ?? ''), false);
          statusLabel.model.set('text', `Loaded ${file.name}`);
          updateLowerInfo();
        };
        reader.readAsText(file);
      };
      input.click();
    } else {
      editor.setText([
        'function greet(name) {',
        '  console.log("Hello, " + name + "!");',
        '}',
        '',
        'greet("DOS Editor");'
      ].join('\n'), false);
      statusLabel.model.set('text', 'Loaded sample');
      updateLowerInfo();
    }
  });

  fileMenu.addItem('Save', () => {
    if (typeof Blob !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([editor.getText()], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'untitled.txt';
      a.click();
      URL.revokeObjectURL(url);
    }
    editor.model.set('modified', false);
    statusLabel.model.set('text', 'Saved untitled.txt');
    updateLowerInfo();
  });

  // Search: Find, Replace, Jump
  let lastFindQuery = '';

  searchMenu.addItem('Find', () => {
    const query = typeof window !== 'undefined'
      ? window.prompt('Find text:', lastFindQuery)
      : lastFindQuery;
    if (!query) return;
    lastFindQuery = query;

    const curLine = editor.model.get('cursorLine') || 0;
    const curCol = editor.model.get('cursorCol') || 0;
    let found = editor.model.findAndSelect(query, curLine, curCol);
    if (!found) {
      found = editor.model.findAndSelect(query, 0, 0);
    }
    statusLabel.model.set('text', found ? `Found "${query}"` : `Not found: "${query}"`);
  });

  searchMenu.addItem('Replace', () => {
    const findStr = typeof window !== 'undefined'
      ? window.prompt('Replace what:', lastFindQuery)
      : lastFindQuery;
    if (!findStr) return;
    lastFindQuery = findStr;

    const replaceStr = typeof window !== 'undefined'
      ? window.prompt(`Replace "${findStr}" with:`, '')
      : '';
    if (replaceStr === null || replaceStr === undefined) return;

    const currentText = editor.getText();
    if (!currentText.includes(findStr)) {
      statusLabel.model.set('text', `Not found: "${findStr}"`);
      return;
    }

    const updatedText = currentText.split(findStr).join(String(replaceStr));
    editor.setText(updatedText, true);
    statusLabel.model.set('text', `Replaced "${findStr}"`);
    updateLowerInfo();
  });

  searchMenu.addItem('Jump', () => {
    const totalLines = (editor.model.get('lines') || ['']).length;
    const raw = typeof window !== 'undefined'
      ? window.prompt(`Jump to line (1-${totalLines}):`, String((editor.model.get('cursorLine') || 0) + 1))
      : '1';
    if (!raw) return;
    const targetLine = parseInt(raw, 10);
    if (Number.isNaN(targetLine)) {
      statusLabel.model.set('text', 'Invalid line number');
      return;
    }
    const clampedLine = Math.min(totalLines - 1, Math.max(0, targetLine - 1));
    editor.model.setCursor(clampedLine, 0);
    statusLabel.model.set('text', `Jumped to line ${clampedLine + 1}`);
  });

  // Help: About
  helpMenu.addItem('About', () => {
    statusLabel.model.set('text', 'EDIT.COM Clone — Canvas GUI TextArea');
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(
        'EDIT.COM Clone\n' +
        'Navigation: Arrows, Home/End, Ctrl+Home/End, PgUp/PgDn\n' +
        'Selection & Clipboard: Shift+Arrow/Click/Drag, Ctrl+A, Ctrl+C/X/V'
      );
    }
  });

  editor = new TextArea({
    x: 0,
    y: editorY,
    width,
    height: editorH,
    text: 'Type here...\nDOS-style canvas editor ready.',
    showLineNumbers: true,
    theme: {
      bg: '#0000aa',
      text: '#ffffff',
      gutterBg: '#000080',
      gutterText: '#80ffff',
      cursorColor: '#ffff55',
      selectionBg: 'rgba(255, 255, 85, 0.28)',
      font: '14px "Courier New", Courier, monospace'
    }
  });

  const lowerPane = new Panel({
    x: 0,
    y: bottomAreaY,
    width,
    height: lowerPaneH,
    theme: {
      bg: '#000066',
      border: '#55ffff'
    }
  });

  const lowerTitleLabel = new Label({
    x: 10,
    y: 4,
    width: width - 20,
    height: 16,
    text: 'BUFFER SUMMARY',
    theme: {
      text: '#ffff55',
      font: 'bold 12px "Courier New", Courier, monospace'
    }
  });

  lowerInfoLabel = new Label({
    x: 10,
    y: 22,
    width: width - 20,
    height: 20,
    text: 'Lines: 2  |  Chars: 42  |  Status: Saved',
    theme: {
      text: '#ffffff',
      font: '13px "Courier New", Courier, monospace'
    }
  });

  lowerPane.add(lowerTitleLabel);
  lowerPane.add(lowerInfoLabel);

  const statusBar = new Panel({
    x: 0,
    y: height - statusBarH,
    width,
    height: statusBarH,
    theme: {
      bg: '#aaaaaa',
      border: '#ffffff'
    }
  });

  statusLabel = new Label({
    x: 8,
    y: 2,
    width: width - 190,
    height: 20,
    text: 'Ready  |  Ln 1, Col 1',
    theme: {
      text: '#000000',
      font: '13px "Courier New", Courier, monospace'
    }
  });

  const posLabel = new Label({
    x: width - 170,
    y: 2,
    width: 160,
    height: 20,
    text: 'INS  |  UTF-8',
    theme: {
      text: '#000000',
      font: '13px "Courier New", Courier, monospace'
    }
  });

  statusBar.add(statusLabel);
  statusBar.add(posLabel);

  editor.model.on('cursor', ({ line, col }) => {
    const modFlag = editor.model.get('modified') ? '*' : '';
    statusLabel.model.set('text', `${modFlag}Ln ${line}, Col ${col}`);
  });

  editor.model.on('change:text', () => {
    updateLowerInfo();
  });

  gui.add(editor);
  gui.add(lowerPane);
  gui.add(menuBar);
  gui.add(statusBar);

  // Attach menus to GUI scene graph so popups render and receive hit-tests
  for (const entry of menuBar._entries) {
    gui.add(entry.menu);
  }

  if (gui.renderer && typeof gui.renderer.renderFrame === 'function') {
    gui.renderer.renderFrame();
  }

  return gui;
}

if (typeof document !== 'undefined') {
  const autoStart = () => {
    const canvas = document.getElementById('edit-canvas');
    if (canvas && !canvas.__editAppInitialized) {
      canvas.__editAppInitialized = true;
      initEditApp('edit-canvas');
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoStart, { once: true });
  } else {
    autoStart();
  }
}
