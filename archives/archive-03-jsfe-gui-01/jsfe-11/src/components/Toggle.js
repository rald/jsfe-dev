import { Widget } from './Widget.js';
import { ToggleModel } from '../models/ToggleModel.js';
import { ToggleView } from '../views/ToggleView.js';
import { ToggleController } from '../controllers/ToggleController.js';

export class Toggle extends Widget {
  constructor(options = {}) {
    const model = new ToggleModel(options);
    super(model, new ToggleView(model), new ToggleController(model));
  }
}
