import { Widget } from './Widget.js';
import { LabelModel } from '../models/LabelModel.js';
import { LabelView } from '../views/LabelView.js';
import { WidgetController } from '../controllers/WidgetController.js';

export class Label extends Widget {
  constructor(options = {}) {
    const model = new LabelModel(options);
    super(model, new LabelView(model), new WidgetController(model));
  }
}
