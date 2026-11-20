import { Widget } from './Widget.js';
import { PanelModel } from '../models/PanelModel.js';
import { PanelView } from '../views/PanelView.js';
import { WidgetController } from '../controllers/WidgetController.js';

export class Panel extends Widget {
  constructor(options = {}) {
    const model = new PanelModel(options);
    super(model, new PanelView(model), new WidgetController(model));
  }
}
