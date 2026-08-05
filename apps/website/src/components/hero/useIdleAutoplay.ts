import { useElementVisibility, useRafFn } from '@vueuse/core'

import type { Ref } from 'vue'
import { onScopeDispose, ref, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { AutoplayState } from './idleAutoplay'
import { advanceAutoplay, startAutoplay } from './idleAutoplay'
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

/** A press suppresses the demo until it ends, however long it lasts; the
 * idle countdown starts at release. Bound to window because a drag that
 * started on a slider can end outside the hero. */
const RELEASE_EVENTS = [
  'pointerup',
  'pointercancel',
  'touchend',
  'touchcancel'
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
  const pointerHeld = ref(false)
  const onScreen = useElementVisibility(target)

  let idleTimer: ReturnType<typeof setTimeout> | undefined

  function restartIdleTimer() {
    idle.value = false
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => (idle.value = true), IDLE_DELAY)
  }

  function onActivity(event: Event) {
    if (event.type === 'pointerdown' || event.type === 'touchstart') {
      // Held interactions suppress the demo outright; the countdown to
      // resuming starts when the press is released, not when it began.
      pointerHeld.value = true
      idle.value = false
      clearTimeout(idleTimer)
      return
    }
    restartIdleTimer()
  }

  function onRelease() {
    if (!pointerHeld.value) return
    pointerHeld.value = false
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
      for (const type of RELEASE_EVENTS) {
        window.addEventListener(type, onRelease, {
          capture: true,
          passive: true
        })
        teardowns.push(() =>
          window.removeEventListener(type, onRelease, { capture: true })
        )
      }
      restartIdleTimer()
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    clearTimeout(idleTimer)
    teardowns.forEach((fn) => fn())
  })

  function seedFromPose(): AutoplayState {
    return startAutoplay({
      azimuth: pose.azimuth,
      elevation: pose.elevation,
      zoom: pose.zoom,
      hue: hue.value,
      saturation: saturation.value
    })
  }

  let state = seedFromPose()

  const { pause, resume } = useRafFn(
    ({ delta }) => {
      state = advanceAutoplay(state, Math.min(delta / 1000, MAX_FRAME_SECONDS))
      pose.azimuth = clampAzimuth(state.azimuth)
      pose.elevation = clampElevation(state.elevation)
      pose.zoom = clampZoom(state.zoom)
      // Hue accumulates unwrapped so each leg keeps turning the same way;
      // wrap on the way out or the handle walks off the end of its track.
      hue.value = ((Math.round(state.hue) % 360) + 360) % 360
      saturation.value = Math.round(state.saturation * 100) / 100
    },
    { immediate: false }
  )

  watch(
    () =>
      idle.value &&
      !pointerHeld.value &&
      !hoveringAngle.value &&
      onScreen.value &&
      !prefersReducedMotion(),
    (active) => {
      if (!active) return pause()
      // Restart from what the visitor left behind, not from the pose this
      // loop last wrote, so taking over and stepping away reads continuous.
      state = seedFromPose()
      resume()
    }
  )
}
