import { SceneNode } from './patterns/SceneNode.js';
import { ComponentFactory } from './patterns/ComponentFactory.js';
import { Command, CommandHistory } from './patterns/Command.js';
import { Renderer } from './core/Renderer.js';
import { InputManager } from './core/InputManager.js';
import { Panel } from './components/Panel.js';
import { Button } from './components/Button.js';
import { Label } from './components/Label.js';
import { Slider } from './components/Slider.js';
import { Toggle } from './components/Toggle.js';
import { TextArea } from './components/TextArea.js';
import { Dialog } from './components/Dialog.js';
import { Window } from './components/Window.js';
import { Menu } from './components/Menu.js';
import { MenuItem } from './components/MenuItem.js';
import { MenuBar } from './components/MenuBar.js';

/**
 * Facade Pattern: Unified entry point for the retained-mode Canvas GUI framework.
 */
export class GUI {
  constructor(canvas, options = {}) {
    this.canvas = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
    if (!this.canvas) {
      throw new Error('GUI requires a valid HTMLCanvasElement or selector.');
    }

    this.root = new SceneNode();
    this.factory = new ComponentFactory();
    this.history = new CommandHistory();
    this.renderer = new Renderer(this.canvas, this.root, options);
    this.input = new InputManager(this.canvas, this.root);

    this._registerDefaultComponents();
    this.renderer.start();
  }

  _registerDefaultComponents() {
    this.factory.register('panel', (opts) => new Panel(opts));
    this.factory.register('button', (opts) => new Button(opts));
    this.factory.register('label', (opts) => new Label(opts));
    this.factory.register('slider', (opts) => new Slider(opts));
    this.factory.register('toggle', (opts) => new Toggle(opts));
    this.factory.register('textarea', (opts) => new TextArea(opts));
    this.factory.register('dialog', (opts) => new Dialog(opts));
    this.factory.register('window', (opts) => new Window(opts));
    this.factory.register('menu', (opts) => new Menu(opts));
    this.factory.register('menuitem', (opts) => new MenuItem(opts));
    this.factory.register('menubar', (opts) => new MenuBar(opts));
  }

  _attachGuiRef(node) {
    node.traverse((n) => {
      n._gui = this;
    });
  }

  create(type, options = {}, parent = this.root) {
    const widget = this.factory.create(type, options);
    if (parent) {
      parent.add(widget);
    }
    this._attachGuiRef(widget);
    return widget;
  }

  add(widget) {
    this.root.add(widget);
    this._attachGuiRef(widget);
    return widget;
  }

  remove(widget) {
    this.root.remove(widget);
    return widget;
  }

  destroy() {
    this.renderer.stop();
    this.input.destroy();
  }
}

export {
  SceneNode,
  ComponentFactory,
  Command,
  CommandHistory,
  Panel,
  Button,
  Label,
  Slider,
  Toggle,
  TextArea,
  Dialog,
  Window,
  Menu,
  MenuItem,
  MenuBar
};
