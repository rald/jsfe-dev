import { WidgetModel } from './WidgetModel.js';

/**
 * Model for a modal dialog box with message, optional text prompt input, and action buttons.
 */
export class DialogModel extends WidgetModel {
  constructor(options = {}) {
    super({
      width: options.width ?? 420,
      height: options.height ?? 160,
      visible: options.visible ?? false,
      ...options,
      theme: {
        bg: '#c0c0c0',
        headerBg: '#0000aa',
        headerText: '#ffffff',
        text: '#000000',
        border: '#000000',
        btnBg: '#808080',
        btnText: '#ffffff',
        btnActive: '#00aa00',
        inputBg: '#ffffff',
        inputText: '#000000',
        radius: 0,
        font: '13px "Courier New", Courier, monospace',
        ...(options.theme || {})
      }
    });

    this._state.title = options.title ?? 'Dialog';
    this._state.message = options.message ?? '';
    this._state.inputValue = options.inputValue ?? '';
    this._state.hasInput = Boolean(options.hasInput ?? false);
    this._state.buttons = options.buttons ?? ['OK', 'Cancel'];
    this._state.hoveredButton = null;
  }

  open(opts = {}) {
    if (opts.title !== undefined) this._state.title = opts.title;
    if (opts.message !== undefined) this._state.message = opts.message;
    if (opts.inputValue !== undefined) this._state.inputValue = opts.inputValue;
    if (opts.hasInput !== undefined) this._state.hasInput = opts.hasInput;
    if (opts.buttons !== undefined) this._state.buttons = opts.buttons;
    this.set('visible', true);
    this.emit('open', { model: this });
  }

  close(result = null) {
    this.set('visible', false);
    this.emit('close', { result, value: this._state.inputValue, model: this });
  }
}
