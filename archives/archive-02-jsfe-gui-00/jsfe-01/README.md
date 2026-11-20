# gui.js

A minimal, zero-dependency, retained-mode HTML5 Canvas GUI library architected with OOP, MVC, and classic GoF Design Patterns.

## Architecture Overview

- **Core (`src/core/`)**: Application lifecycle, render loop, and layout engine.
- **Patterns (`src/patterns/`)**: Observer (`EventEmitter`), Composite (`SceneNode`), Factory (`ComponentFactory`), Command (`Command`), and Visitor (`RenderVisitor`).
- **Models (`src/models/`)**: Reactive state stores (`WidgetModel`, `ButtonModel`, `SliderModel`, `ToggleModel`, `PanelModel`) notifying views on mutation.
- **Views (`src/views/`)**: Stateless/retained canvas renderers (`WidgetView`, `ButtonView`, `LabelView`, `SliderView`, `ToggleView`, `PanelView`).
- **Controllers (`src/controllers/`)**: Hit-testing, pointer event routing, focus/capture management, and user interaction translation (`InputController`, `ButtonController`, `SliderController`, `ToggleController`).
- **Components (`src/components/`)**: High-level facades assembling Model + View + Controller (`Button`, `Label`, `Slider`, `Toggle`, `Panel`).
- **Entry (`src/gui.js`)**: Public API and facade.

## Quick Start

Serve the root folder with any static HTTP server (e.g. `npx serve .`) and open `examples/index.html`.
