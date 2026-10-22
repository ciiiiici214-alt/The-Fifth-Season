/* Inference lives off the rendering thread. The blob also works with file://. */
(function (root) {
  'use strict';
  async function workerMain() {
    let task;
    onmessage = async ({ data }) => {
      try {
        if (data.type === 'init') {
          self.exports = {};
          importScripts(data.base + 'vision-classic.js');
          const { HandLandmarker, FilesetResolver } = self.exports;
          const files = await FilesetResolver.forVisionTasks(data.base + 'wasm');
          task = await HandLandmarker.createFromOptions(files, {
            baseOptions: { modelAssetPath: data.base + 'hand_landmarker.task' },
            runningMode: 'VIDEO', numHands: 2,
            minHandDetectionConfidence: .45, minTrackingConfidence: .45
          });
          postMessage({ type: 'ready' });
        } else if (data.type === 'frame') {
          try {
            const result = task.detectForVideo(data.bitmap, data.now);
            postMessage({ type: 'result', landmarks: result.landmarks });
          } finally { data.bitmap.close(); }
        }
      } catch (error) { postMessage({ type: 'error', message: error.message }); }
    };
  }
  async function create(baseURL = document.baseURI) {
    let worker;
    const base = new URL('assets/mediapipe/', baseURL).href;
    try {
      const url = URL.createObjectURL(new Blob([`(${workerMain.toString()})();`], { type: 'text/javascript' }));
      // MediaPipe's WASM loader uses importScripts: use a classic worker.
      try { worker = new Worker(url); }
      finally { URL.revokeObjectURL(url); }
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Worker initialization timeout')), 18000);
        worker.onerror = event => { clearTimeout(timer); reject(new Error(event.message)); };
        worker.onmessage = ({ data }) => {
          clearTimeout(timer);
          data.type === 'ready' ? resolve() : reject(new Error(data.message));
        };
        worker.postMessage({ type: 'init', base });
      });
      return {
        threaded: true,
        async detect(video, now) {
          const bitmap = await createImageBitmap(video, { resizeWidth: 256, resizeHeight: 192 });
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Hand tracking timeout')), 3000);
            worker.onerror = event => { clearTimeout(timer); reject(new Error(event.message)); };
            worker.onmessage = ({ data }) => {
              clearTimeout(timer);
              data.type === 'result' ? resolve(data.landmarks) : reject(new Error(data.message));
            };
            worker.postMessage({ type: 'frame', bitmap, now }, [bitmap]);
          });
        }
      };
    } catch (error) {
      worker?.terminate();
      console.warn('Hand worker unavailable; using GPU fallback:', error.message);
      // Older browsers keep a low-rate fallback; rendering itself stays at RAF.
      const local = location.protocol !== 'file:';
      const { HandLandmarker, FilesetResolver } = await import(local ? base + 'vision_bundle.mjs' : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs');
      const files = await FilesetResolver.forVisionTasks(local ? base + 'wasm' : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
      const task = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: local ? base + 'hand_landmarker.task' : 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' },
        runningMode: 'VIDEO', numHands: 2
      });
      return { threaded: false, async detect(video, now) { return task.detectForVideo(video, now).landmarks; } };
    }
  }
  root.FifthSeasonHandTracker = { create };
})(globalThis);
