import { Widget } from './Widget.js';
import { ButtonModel } from '../models/ButtonModel.js';
import { ButtonView } from '../views/ButtonView.js';
import { ButtonController } from '../controllers/ButtonController.js';

export class Button extends Widget {
  constructor(options = {}) {
    const model = new ButtonModel(options);
    super(model, new ButtonView(model), new ButtonController(model));
  }
}
