/**
 * The demo's words, kept beside it rather than in the Hub's translation
 * tables: this page is a prototype, English only, and meant to come out whole.
 */
export const copy = {
  input: 'Input',
  output: 'Output',
  video: 'Video',
  videoHelp:
    'A 5 to 15 second clip with a clear subject and no letterbox bars.',
  clipLength: (seconds: number) =>
    `This clip is ${seconds.toFixed(1)} s. Use one between 5 and 15 seconds.`,
  wholeClip: (frames: number) =>
    `Uses the whole clip: ${frames} frames at 24 fps (${(frames / 24).toFixed(1)} s), the most MiniMax H3's 17k + 5 frame grid fits.`,
  aspect: 'Aspect ratio',
  aspects: {
    source: 'Match source',
    '16:9': '16:9',
    '9:16': '9:16',
    '1:1': '1:1',
    '4:3': '4:3',
    '3:4': '3:4',
    '21:9': '21:9'
  } as Record<string, string>,
  size: 'Output size',
  sizes: [
    { mp: 0.4, label: '480p', help: '0.4 MP · 864×480 at 16:9 · faster' },
    {
      mp: 1.0,
      label: '768p',
      help: '1.0 MP · 1376×768 at 16:9 · sharper, slower'
    }
  ],
  analyze: 'Analyze depth',
  reanalyze: 'Analyze depth again',
  analyzeHelp:
    'Estimates depth for every frame, then hands the scene to this page so you can aim a new camera without waiting on the server.',
  camera: 'New camera',
  cameraHelp:
    'Or drag the preview itself. Magenta is what the original camera never saw; the model paints it in.',
  azimuth: 'Azimuth',
  elevation: 'Elevation',
  distance: 'Distance',
  distanceHelp:
    'The current LoRA follows distance loosely. Angles are what it is good at.',
  lens: 'Lens FOV',
  shift: 'Vertical shift',
  keepAim: 'Keep the source camera’s aim',
  keepAimHelp:
    'Orbit the subject but keep looking where the original looked, as the training data does.',
  zones: {
    green: 'Inside the range the LoRA was checked on.',
    yellow: 'Trained, but less reliable.',
    red: 'Outside training. The hidden side will be invented.'
  },
  move: 'Camera move',
  moveHelp:
    'Scrub to a frame, aim, press Key. Two or more keys make a move; the camera holds before the first and after the last.',
  key: 'Key',
  unkey: 'Remove key',
  clearKeys: 'Clear keys',
  motion: 'Motion',
  motions: {
    linear: 'Linear',
    ease_in: 'Ease in',
    ease_out: 'Ease out',
    ease_in_out: 'Ease in and out',
    smooth: 'Smooth spline'
  } as Record<string, string>,
  prompt: 'What the new view reveals',
  optional: 'Optional',
  promptHelp:
    'Describe what should fill the areas the original camera never saw.',
  promptDialogue:
    'The model also makes the sound: if your video has dialogue, write the lines here so the new take says them.',
  promptPlaceholder: 'e.g. a stone wall behind her, more wheat to the left',
  seed: 'Seed',
  generate: 'Generate',
  cancel: 'Cancel',
  play: 'Play',
  pause: 'Pause',
  frame: (n: number, of: number) => `Frame ${n} / ${of}`,
  empty: 'Choose a video, then analyze its depth to aim a new camera.',
  stale:
    'Aspect ratio or output size changed, so the depth has to be analyzed again.',
  dragHint: 'Drag to orbit · Scroll to move closer',
  stages: {
    uploading: 'Uploading the video',
    queued: 'Waiting for a server',
    queuedAt: (position: number) => `Queued · position ${position}`,
    starting: 'Starting a server. The first run of the day loads the models.',
    running: 'Running',
    downloading: 'Fetching the result'
  },
  analyzing: 'Estimating depth',
  result: 'Result',
  analyzingTitle: 'Analyzing depth',
  analyzingHelp:
    'Uploads the clip, then MoGe estimates depth for every frame. The first run after a quiet spell also starts a server.',
  generatingTitle: 'Generating the new view',
  generatingHelp:
    'The camera is locked while this runs. The first run after a quiet spell also loads the model.',
  viewResult: 'View result',
  compare: 'Drag to compare the source clip and the result',
  exampleHelp:
    'The same clip, re-shot from a new angle at 768p — drag the seam to compare. Analyze its depth to aim a camera of your own, or choose another clip.',
  sound: 'Sound',
  sounds: { generated: 'Generated', original: 'Original clip' } as Record<
    string,
    string
  >,
  takeStatic: (n: number, az: number, el: number) =>
    `Take ${n} · az ${az}° el ${el}°`,
  takeMove: (n: number, keys: number) => `Take ${n} · move, ${keys} keys`,
  warp: 'Warp guide',
  source: 'Source',
  again: 'Adjust the camera',
  download: 'Download',
  failed: 'Something went wrong',
  noWebgl: 'This preview needs WebGL2, which this browser does not offer.',
  demoNote:
    'Prototype: runs on a dedicated Comfy API deployment through a local proxy. Nothing here uses your Comfy account or credits.'
} as const
