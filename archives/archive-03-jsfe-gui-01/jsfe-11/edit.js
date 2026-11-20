import { createApp } from './src/gui.js';
import { TextArea } from './src/components/TextArea.js';
import { MenuBar } from './src/components/MenuBar.js';
import { Panel } from './src/components/Panel.js';
import { Label } from './src/components/Label.js';

export function initEditApp(canvasId = 'edit-canvas') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) throw new Error(`Canvas #${canvasId} not found`);

  const app = createApp(canvas, {
    width: 800,
    height: 600,
    bg: '#000080'
  });

  const menuBarH = 24;
  const statusBarH = 24;
  const lowerPaneH = 48;
  const editorY = menuBarH;
  const editorH = app.height - menuBarH - statusBarH - lowerPaneH;
  const bottomAreaY = editorY + editorH;

  const menuBar = new MenuBar({ x: 0, y: 0, width: app.width, height: menuBarH });

  const fileMenu = menuBar.addMenu('File');
  const editMenu = menuBar.addMenu('Edit');
  const viewMenu = menuBar.addMenu('View');
  const helpMenu = menuBar.addMenu('Help');

  let editor;
  let lowerInfoLabel;

  const updateLowerInfo = () => {
    const text = editor.getText();
    const lines = text.split('\n').length;
    const chars = text.length;
    const mod = editor.model.get('modified') ? 'Modified' : 'Saved';
    lowerInfoLabel.model.set(`Lines: ${lines}  |  Chars: ${chars}  |  Status: ${mod}`);
  };

  fileMenu.addItem('New', () => {
    editor.setText('', false);
    statusLabel.model.set('New file');
    updateLowerInfo();
  });

  fileMenu.addItem('Open Sample', () => {
    editor.setText([
      'function greet(name) {',
      '  console.log("Hello, " + name + "!");',
      '}',
      '',
      'greet("DOS Editor");'
    ].join('\n'), false);
    statusLabel.model.set('Loaded sample');
    updateLowerInfo();
  });

  fileMenu.addItem('Save (Download)', () => {
    const blob = new Blob([editor.getText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'untitled.txt';
    a.click();
    URL.revokeObjectURL(url);
    editor.model.set('modified', false);
    statusLabel.model.set('Saved untitled.txt');
    updateLowerInfo();
  });

  editMenu.addItem('Select All', () => {
    editor.selectAll();
    statusLabel.model.set('Selected all');
  });

  editMenu.addItem('Copy', () => {
    editor.copy();
    statusLabel.model.set('Copied selection');
  });

  editMenu.addItem('Cut', () => {
    editor.cut();
    statusLabel.model.set('Cut selection');
    updateLowerInfo();
  });

  editMenu.addItem('Paste', () => {
    editor.paste();
    statusLabel.model.set('Pasted clipboard');
    updateLowerInfo();
  });

  editMenu.addItem('Clear', () => {
    editor.setText('', true);
    statusLabel.model.set('Cleared editor');
    updateLowerInfo();
  });

  viewMenu.addItem('Toggle Line Numbers', () => {
    const next = !editor.model.get('showLineNumbers');
    editor.model.set('showLineNumbers', next);
    statusLabel.model.set(`Line numbers: ${next ? 'ON' : 'OFF'}`);
  });

  helpMenu.addItem('About', () => {
    editor.setText(
      editor.getText() +
      (editor.getText() ? '\n\n' : '') +
      '-- DOS Text Editor (Canvas MVC GUI) --\nUse arrow keys, Home/End, PgUp/PgDn, Shift+drag to highlight, Ctrl+C/X/V.',
      true
    );
    statusLabel.model.set('About info inserted');
    updateLowerInfo();
  });

  editor = new TextArea({
    x: 0,
    y: editorY,
    width: app.width,
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

  // Occupy the space below the textarea above the status bar with an info/summary pane
  const lowerPane = new Panel({
    x: 0,
    y: bottomAreaY,
    width: app.width,
    height: lowerPaneH,
    theme: {
      bg: '#000066',
      border: '#55ffff'
    }
  });

  const lowerTitleLabel = new Label({
    x: 10,
    y: 6,
    text: 'BUFFER SUMMARY',
    theme: {
      text: '#ffff55',
      font: 'bold 12px "Courier New", Courier, monospace'
    }
  });

  lowerInfoLabel = new Label({
    x: 10,
    y: 24,
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
    y: app.height - statusBarH,
    width: app.width,
    height: statusBarH,
    theme: {
      bg: '#aaaaaa',
      border: '#ffffff'
    }
  });

  const statusLabel = new Label({
    x: 8,
    y: 4,
    text: 'Ready  |  Ln 1, Col 1',
    theme: {
      text: '#000000',
      font: '13px "Courier New", Courier, monospace'
    }
  });

  const posLabel = new Label({
    x: app.width - 170,
    y: 4,
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
    statusLabel.model.set(`${modFlag}Ln ${line}, Col ${col}`);
  });

  editor.model.on('change:text', () => {
    updateLowerInfo();
  });

  app.root.add(editor);
  app.root.add(lowerPane);
  app.root.add(menuBar);
  app.root.add(statusBar);

  app.start();
  return app;
}
