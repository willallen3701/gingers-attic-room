// Which background-removal model the "Add an item" sheet runs, and how to feed it.
// The model file ships with the room app (assets/models/) and is cached in the browser after first use.
// Values follow rembg's session code for the same model (see assets-src/bgremoval-eval/results.json).

export const ORT_VERSION = '1.31.1';
export const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

// isnet-general-use (Apache-2.0, DIS) with int8 weights, 46.5 MB: same masks as the 178 MB original
// on the 14-photo test set (IoU >= 0.98), checked in onnxruntime-web 1.31.1 against Python.
export const MODEL_SPEC = Object.freeze({
  id: 'isnet-general-use-int8w',
  url: 'assets/models/isnet-general-use-int8w.onnx',
  approxMB: 47,
  size: 1024, // square input, the photo is stretched to it (as rembg does)
  mean: [0.5, 0.5, 0.5],
  std: [1, 1, 1],
  divideByMax: true,
  sigmoid: false, // the model applies its own sigmoid; the output is only min-max normalised
  inputName: 'input_image',
  outputName: 'output_image',
  // Turn the int8 weights back into float32 once at load (no speed or quality change in WASM).
  sessionExtra: { session: { disable_quant_qdq: '1' } },
});
