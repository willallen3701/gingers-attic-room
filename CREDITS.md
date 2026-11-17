# Credits

Photos used under Creative Commons Attribution licences. Images were modified (background removed, trimmed, resized).

- **Lamp** by Tiffany Studios, CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Source: https://www.brooklynmuseum.org/opencollection/objects/1513. Used as `assets/items/it-amber-lamp.png`.
- **books** by ali edwards, CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/). Source: https://www.flickr.com/photos/96666162@N00/543067160. Used as `assets/items/it-book-stack.png`.
- **Marbled Paper** by Photoshop Roadmap, CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/). Source: https://www.flickr.com/photos/36546102@N04/7564183154. Used as `assets/items/it-framed-art.png`.
- **Old horseshoe** by Carlos Ebert, CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/). Source: https://www.flickr.com/photos/42042512@N00/14807603764. Used as `assets/items/it-horseshoe.png`.
- **Bedford 1 ton tipper** by Elsie esq., CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/). Source: https://www.flickr.com/photos/61132483@N00/124354529. Used as `assets/items/it-iron-truck.png`.
- **Mug LACMA 27.1.6** by Fæ, CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/). Source: https://www.flickr.com/photos/50398299@N08/16416691481. Used as `assets/items/it-mug-brown.png`.
- **Starý telefón; Old black phone** by Da4Sal, CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/). Source: https://www.flickr.com/photos/112931986@N07/11645033223. Used as `assets/items/it-rotary-phone.png`.
- **Motorcycle with sidecar, USSR** by lord enfield, CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/). Source: https://www.flickr.com/photos/42424413@N06/5157730294. Used as `assets/items/it-tin-motorcycle.png`.
- **Easy Chair with C-scroll Arms LACMA M.2006.51.6** by Fæ, CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/). Source: https://www.flickr.com/photos/50398299@N08/16219050369. Used as `assets/items/it-yellow-chair.png`.

All other images are CC0 / public domain or generated for this project; see `assets-src/LICENSES.md` for the full list.

## Background-removal model

`assets/models/isnet-general-use-int8w.onnx` is the IS-Net "isnet-general-use" model from DIS (https://github.com/xuebinqin/DIS), Copyright Xuebin Qin et al., licensed under the Apache License 2.0 (text in `assets/models/LICENSE-Apache-2.0.txt`). The ONNX export comes from rembg (https://github.com/danielgatis/rembg, MIT). **Modified for Ginger's Attic:** convolution weights stored as int8 (weight-only quantisation) and the graph cut down to the single mask output. Evaluation notes: `assets-src/bgremoval-eval/`.

The in-browser runtime is onnxruntime-web 1.31.1 (MIT, Microsoft), loaded from jsDelivr.
