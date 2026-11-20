import { Widget } from './Widget.js';
import { TextAreaModel } from '../models/TextAreaModel.js';
import { TextAreaView } from '../views/TextAreaView.js';
import { TextAreaController } from '../controllers/TextAreaController.js';

export class TextArea extends Widget {
  constructor(options = {}) {
    const model = new TextAreaModel(options);
    super(model, new TextAreaView(model), new TextAreaController(model));
  }

  getText() {
    return this.model.getText();
  }

  setText(text, markModified = false) {
    this.model.setText(text, markModified);
    return this;
  }

  copy() {
    return this.model.copy();
  }

  cut() {
    return this.model.cut();
  }

  paste(text = null) {
    this.model.paste(text);
    return this;
  }

  selectAll() {
    this.model.selectAll();
    return this;
  }
}
