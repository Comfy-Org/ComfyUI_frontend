import { useElementVisibility, useRafFn } from '@vueuse/core'

import type { Ref } from 'vue'
import { onScopeDispose, ref, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { AutoplayState } from './idleAutoplay'
import { advanceAutoplay } from './idleAutoplay'
import type { CameraPose } from './cameraVocabulary'
import { clampAzimuth, clampElevation, clampZoom } from './cameraVocabulary'

const IDLE_DELAY = 1000

/** Only deliberate interaction with the hero itself counts as activity —
 * pointerdown covers clicks and drags on the nodes and sliders, keydown the
 * hidden range inputs, wheel the camera zoom. Page-level mouse movement no
 * longer holds the demo back. */
const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart'
] as const

/** A backgrounded tab resumes with one enormous frame delta; cap it so the
 * pose eases onward instead of teleporting. */
const MAX_FRAME_SECONDS = 0.1

interface HeroPipelineState {
  pose: CameraPose
  hue: Ref<number>
  saturation: Ref<number>
}

/**
 * Lets the hero demonstrate itself once the visitor has left it alone, driving
 * the camera pose and colour grade until they take over again. Activity is
 * scoped to the hero element, hovering the 3D ANGLE node holds the demo still,
 * and it runs only while the graph is on screen, so the desktop and mobile
 * copies never animate at once.
 */
export function useIdleAutoplay(
  { pose, hue, saturation }: HeroPipelineState,
  target: Ref<HTMLElement | undefined>
): void {
  const idle = ref(false)
  const hoveringAngle = ref(false)
  const onScreen = useElementVisibility(target)

  let idleTimer: ReturnType<typeof setTimeout> | undefined

  function restartIdleTimer() {
    idle.value = false
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => (idle.value = true), IDLE_DELAY)
  }

  function onActivity() {
    restartIdleTimer()
  }

  function onPointerOver(event: Event) {
    hoveringAngle.value = Boolean(
      (event.target as Element | null)?.closest('[data-hero-angle]')
    )
  }

  function onPointerLeave() {
    hoveringAngle.value = false
  }

  const teardowns: (() => void)[] = []

  watch(
    target,
    (el) => {
      teardowns.forEach((fn) => fn())
      teardowns.length = 0
      if (!el) return
      for (const type of ACTIVITY_EVENTS) {
        el.addEventListener(type, onActivity, { capture: true, passive: true })
        teardowns.push(() =>
          el.removeEventListener(type, onActivity, { capture: true })
        )
      }
      el.addEventListener('pointerover', onPointerOver, { passive: true })
      el.addEventListener('pointerleave', onPointerLeave, { passive: true })
      teardowns.push(() => {
        el.removeEventListener('pointerover', onPointerOver)
        el.removeEventListener('pointerleave', onPointerLeave)
      })
      restartIdleTimer()
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    clearTimeout(idleTimer)
    teardowns.forEach((fn) => fn())
  })

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
    () =>
      idle.value &&
      !hoveringAngle.value &&
      onScreen.value &&
      !prefersReducedMotion(),
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
