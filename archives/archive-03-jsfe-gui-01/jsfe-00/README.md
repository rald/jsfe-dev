# gui.js

A minimal, zero-dependency, retained-mode HTML5 Canvas GUI library architected with OOP, MVC, and classic GoF Design Patterns.

## Architecture Overview

- **Core (`src/core/`)**: Application lifecycle, retained render loop (`Renderer`), and pointer/focus/capture routing (`InputManager`).
- **Patterns (`src/patterns/`)**: Observer (`EventEmitter`), Composite (`SceneNode`), Factory (`ComponentFactory`), and Command (`Command`, `CommandHistory`).
- **Models (`src/models/`)**: Reactive state stores (`WidgetModel`, `PanelModel`, `ButtonModel`, `LabelModel`, `SliderModel`, `ToggleModel`, `WindowModel`, `MenuModel`, `MenuItemModel`, `MenuBarModel`).
- **Views (`src/views/`)**: Canvas 2D renderers (`WidgetView`, `PanelView`, `ButtonView`, `LabelView`, `SliderView`, `ToggleView`, `WindowView`, `MenuView`, `MenuItemView`, `MenuBarView`).
- **Controllers (`src/controllers/`)**: Hit-testing and pointer interaction controllers (`WidgetController`, `ButtonController`, `SliderController`, `ToggleController`, `WindowController`, `MenuController`, `MenuItemController`, `MenuBarController`).
- **Components (`src/components/`)**: High-level MVC composite widgets (`Widget`, `Panel`, `Button`, `Label`, `Slider`, `Toggle`, `Window`, `Menu`, `MenuItem`, `MenuBar`).
- **Entry (`src/gui.js`)**: Public API and facade.

## Quick Start

Serve the root folder with any static HTTP server (e.g. `npx serve .`) and open `examples/showcase.html`.
