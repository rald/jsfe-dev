# gui.js + edit.js

A minimal, zero-dependency, retained-mode HTML5 Canvas GUI library architected with OOP, MVC, and classic GoF Design Patterns, including a minimal `EDIT.COM` clone (`edit.js`).

## Architecture Overview

- **Core (`src/core/`)**: Application lifecycle, retained render loop (`Renderer`), and pointer/focus/capture routing (`InputManager`).
- **Patterns (`src/patterns/`)**: Observer (`EventEmitter`), Composite (`SceneNode`), Factory (`ComponentFactory`), and Command (`Command`, `CommandHistory`).
- **Models (`src/models/`)**: Reactive state stores (`WidgetModel`, `PanelModel`, `ButtonModel`, `LabelModel`, `SliderModel`, `ToggleModel`, `TextAreaModel`, `DialogModel`, `WindowModel`, `MenuModel`, `MenuItemModel`, `MenuBarModel`).
- **Views (`src/views/`)**: Canvas 2D renderers (`WidgetView`, `PanelView`, `ButtonView`, `LabelView`, `SliderView`, `ToggleView`, `TextAreaView`, `DialogView`, `WindowView`, `MenuView`, `MenuItemView`, `MenuBarView`).
- **Controllers (`src/controllers/`)**: Hit-testing, pointer, and keyboard interaction controllers (`WidgetController`, `ButtonController`, `SliderController`, `ToggleController`, `TextAreaController`, `DialogController`, `WindowController`, `MenuController`, `MenuItemController`, `MenuBarController`).
- **Components (`src/components/`)**: High-level MVC composite widgets (`Widget`, `Panel`, `Button`, `Label`, `Slider`, `Toggle`, `TextArea`, `Dialog`, `Window`, `Menu`, `MenuItem`, `MenuBar`).
- **EDIT.COM Clone (`edit.js` & `examples/edit.html`)**: Classic MS-DOS `EDIT.COM` inspired text editor with `File`, `Edit`, `Search`, and `Options` menus, line/column status bar, modal dialogs, and interactive text editing.
