import { shallowRef } from 'vue'

import type { RunScene } from './run-scenes'

/**
 * The state the panel has been stood up in, or none while it runs for real.
 * The control that sets it and the panel that reads it are separate islands
 * on the page, so the state they share lives here rather than in either.
 */
export const previewScene = shallowRef<RunScene>()
