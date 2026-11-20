import { Widget } from './Widget.js';
import { DialogModel } from '../models/DialogModel.js';
import { DialogView } from '../views/DialogView.js';
import { DialogController } from '../controllers/DialogController.js';

export class Dialog extends Widget {
  constructor(options = {}) {
    const model = new DialogModel(options);
    super(model, new DialogView(model), new DialogController(model));
  }

  open(opts) {
    this.model.open(opts);
    return this;
  }

  close(result) {
    this.model.close(result);
    return this;
  }
}
