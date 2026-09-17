import { ColorViewModel } from './viewmodel/colorViewModel.js';
import { ColorView } from './view/colorView.js';

new ColorView(document, new ColorViewModel({ rgb: [255, 0, 0] }));
