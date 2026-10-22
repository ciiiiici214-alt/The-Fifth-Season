# Local hand-tracking runtime

Google MediaPipe Tasks Vision 0.10.32, distributed under Apache-2.0.

- Official package: https://www.npmjs.com/package/@mediapipe/tasks-vision
- Source and license: https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE
- `vision-classic.js` is an unchanged copy of the package's `vision_bundle.cjs` for browser Worker MIME compatibility.
- `vision_bundle.mjs` and the `wasm` directory are unchanged official package files.
- `hand_landmarker.task` is the official float16 hand landmark model from https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

These assets are loaded lazily only when enabling the camera. The game does not load the model during the opening animation.
