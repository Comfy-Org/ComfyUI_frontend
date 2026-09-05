import { useElementVisibility, useRafFn } from '@vueuse/core'

import type { Ref } from 'vue'
import { computed, onScopeDispose, ref, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { AutoplayState } from './idleAutoplay'
import { advanceAutoplay, isAutoplayDone, startAutoplay } from './idleAutoplay'
import type { CameraPose } from './cameraVocabulary'
import { clampAzimuth, clampElevation, clampZoom } from './cameraVocabulary'

/** How long the hero must sit untouched before the one-shot demo starts. */
const START_DELAY = 1500

/** What counts as deliberately taking the controls. A mouse press anywhere on
 * the hero qualifies (cards, sliders, the 3D scene); a touch only when it
 * lands on an actual control or a draggable node — a touch elsewhere is just
 * the page scrolling past. */
const CONTROL_SELECTOR =
  'a, button, input, label, [role="slider"], [data-camera-scene], [data-hero-node]'

/** A backgrounded tab resumes with one enormous frame delta; cap it so the
 * pose eases onward instead of teleporting. */
const MAX_FRAME_SECONDS = 0.1

interface HeroPipelineState {
  pose: CameraPose
  hue: Ref<number>
  saturation: Ref<number>
}

/**
 * Lets the hero demonstrate itself exactly once. If the visitor hasn't touched
 * it shortly after it comes on screen, the camera makes one full orbit and
 * settles back where it started; any deliberate interaction — before or during
 * the tour — cancels it for good, so the demo never fights the visitor for the
 * controls. Hovering the 3D ANGLE node holds the tour still, and it only
 * advances while the graph is on screen, so the desktop and mobile copies
 * never animate at once. `prefers-reduced-motion` disables it entirely.
 */
export function useIdleAutoplay(
  { pose, hue, saturation }: HeroPipelineState,
  target: Ref<HTMLElement | undefined>
): void {
  const armed = ref(false)
  const dismissed = ref(false)
  const hoveringAngle = ref(false)
  const onScreen = useElementVisibility(target)

  let startTimer: ReturnType<typeof setTimeout> | undefined

  function dismiss() {
    dismissed.value = true
    clearTimeout(startTimer)
  }

  function onPointerDown(event: Event) {
    const { pointerType, target: pressed } = event as PointerEvent
    if (
      pointerType === 'mouse' ||
      (pressed as Element | null)?.closest(CONTROL_SELECTOR)
    )
      dismiss()
  }

  function onWheel(event: Event) {
    if ((event.target as Element | null)?.closest('[data-camera-scene]'))
      dismiss()
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
      clearTimeout(startTimer)
      if (!el) return
      const listeners: [string, (event: Event) => void][] = [
        ['pointerdown', onPointerDown],
        ['keydown', dismiss],
        ['wheel', onWheel],
        ['pointerover', onPointerOver],
        ['pointerleave', onPointerLeave]
      ]
      for (const [type, handler] of listeners) {
        el.addEventListener(type, handler, { capture: true, passive: true })
        teardowns.push(() =>
          el.removeEventListener(type, handler, { capture: true })
        )
      }
      startTimer = setTimeout(() => (armed.value = true), START_DELAY)
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    clearTimeout(startTimer)
    teardowns.forEach((fn) => fn())
  })

  let state: AutoplayState | undefined

  const { pause, resume } = useRafFn(
    ({ delta }) => {
      if (!state) return
      state = advanceAutoplay(state, Math.min(delta / 1000, MAX_FRAME_SECONDS))
      pose.azimuth = clampAzimuth(state.azimuth)
      pose.elevation = clampElevation(state.elevation)
      pose.zoom = clampZoom(state.zoom)
      // Hue accumulates unwrapped so each leg keeps turning the same way;
      // wrap on the way out or the handle walks off the end of its track.
      hue.value = ((Math.round(state.hue) % 360) + 360) % 360
      saturation.value = Math.round(state.saturation * 100) / 100
      if (isAutoplayDone(state)) dismissed.value = true
    },
    { immediate: false }
  )

  const playing = computed(
    () =>
      armed.value &&
      !dismissed.value &&
      !hoveringAngle.value &&
      onScreen.value &&
      !prefersReducedMotion()
  )

  watch(playing, (active) => {
    if (!active) return pause()
    // Seed once, from the untouched pose; a hover or scroll-away pause
    // resumes the same tour rather than starting a new one.
    state ??= startAutoplay({
      azimuth: pose.azimuth,
      elevation: pose.elevation,
      zoom: pose.zoom,
      hue: hue.value,
      saturation: saturation.value
    })
    resume()
  })
}
