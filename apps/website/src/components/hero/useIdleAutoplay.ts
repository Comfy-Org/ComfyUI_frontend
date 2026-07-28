import { useElementVisibility, useIdle, useRafFn } from '@vueuse/core'

import type { Ref } from 'vue'
import { watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { AutoplayState } from './idleAutoplay'
import { advanceAutoplay } from './idleAutoplay'
import type { CameraPose } from './cameraVocabulary'
import { clampAzimuth, clampElevation, clampZoom } from './cameraVocabulary'

const IDLE_DELAY = 3000

/** Pointer events are listed alongside the mouse/touch defaults so dragging a
 * slider or the camera gizmo counts as activity on every input device. */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'wheel',
  'touchstart',
  'pointerdown',
  'pointermove',
  'resize'
]

/** A backgrounded tab resumes with one enormous frame delta; cap it so the
 * pose eases onward instead of teleporting. */
const MAX_FRAME_SECONDS = 0.1

interface HeroPipelineState {
  pose: CameraPose
  hue: Ref<number>
  saturation: Ref<number>
}

/**
 * Lets the hero demonstrate itself once the visitor has been idle, driving the
 * camera pose and colour grade until they take over again. Runs only while the
 * graph is on screen, so the desktop and mobile copies never animate at once.
 */
export function useIdleAutoplay(
  { pose, hue, saturation }: HeroPipelineState,
  target: Ref<HTMLElement | undefined>
): void {
  const { idle } = useIdle(IDLE_DELAY, { events: ACTIVITY_EVENTS })
  const onScreen = useElementVisibility(target)

  let state: AutoplayState = {
    phase: 0,
    azimuth: pose.azimuth,
    elevation: pose.elevation,
    zoom: pose.zoom,
    hue: hue.value,
    saturation: saturation.value
  }

  const { pause, resume } = useRafFn(
    ({ delta }) => {
      state = advanceAutoplay(state, Math.min(delta / 1000, MAX_FRAME_SECONDS))
      pose.azimuth = clampAzimuth(state.azimuth)
      pose.elevation = clampElevation(state.elevation)
      pose.zoom = clampZoom(state.zoom)
      hue.value = Math.round(state.hue)
      saturation.value = Math.round(state.saturation * 100) / 100
    },
    { immediate: false }
  )

  watch(
    () => idle.value && onScreen.value && !prefersReducedMotion(),
    (active) => {
      if (!active) return pause()
      // Restart from what the visitor left behind, not from the pose this
      // loop last wrote, so taking over and stepping away reads continuous.
      state = {
        phase: 0,
        azimuth: pose.azimuth,
        elevation: pose.elevation,
        zoom: pose.zoom,
        hue: hue.value,
        saturation: saturation.value
      }
      resume()
    }
  )
}
