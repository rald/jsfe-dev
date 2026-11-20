import { Widget } from './Widget.js';
import { SliderModel } from '../models/SliderModel.js';
import { SliderView } from '../views/SliderView.js';
import { SliderController } from '../controllers/SliderController.js';

export class Slider extends Widget {
  constructor(options = {}) {
    const model = new SliderModel(options);
    super(model, new SliderView(model), new SliderController(model));
  }
}
