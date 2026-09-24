import { useMounted } from '@vueuse/core'
import { computed, onScopeDispose, readonly, shallowRef } from 'vue'

import type { WorkshopSession } from '../config/workshop-session-state'
import type { AspectRatio } from '../lib/workshop/cinematic-studio/catalog'
import type { StudioGate } from '../lib/workshop/cinematic-studio/gate'
import type { Reel, ReelEvent } from '../lib/workshop/cinematic-studio/reel'
import {
  EMPTY_REEL,
  isRendering,
  reduceReel
} from '../lib/workshop/cinematic-studio/reel'

const DEMO_FRAMES = [
  'bus-stop',
  'neon-street',
  'motel',
  'train',
  'desert',
  'portrait',
  'diner',
  'letter',
  'red-coat'
].map((name) => `/images/cinematic-studio/${name}.jpg`)

const DEMO_RENDER_MS = 1600

interface DemoShot {
  readonly modelSlug: string
  readonly prompt: string
  readonly aspect: AspectRatio
  readonly takes: number
}

export function isCinematicDemo(): boolean {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('demo') === '1'
  )
}

/**
 * A stand-in for the Router run, for design review without credits: each take
 * resolves to one of the studio's sample frames after a short wait. Nothing
 * leaves the browser.
 */
export function useCinematicDemoRun() {
  const mounted = useMounted()
  const reel = shallowRef<Reel>(EMPTY_REEL)
  const dispatch = (event: ReelEvent) => {
    reel.value = reduceReel(reel.value, event)
  }
  const rendering = computed(() => isRendering(reel.value))
  const gate = computed<StudioGate>(() => (mounted.value ? 'ready' : 'pending'))
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let frame = 0

  function generate(shot: DemoShot) {
    if (rendering.value) return
    const ids = Array.from({ length: shot.takes }, () => crypto.randomUUID())
    dispatch({
      type: 'shotStarted',
      ids,
      prompt: shot.prompt,
      modelSlug: shot.modelSlug,
      aspect: shot.aspect
    })
    ids.forEach((id, index) => {
      const url = DEMO_FRAMES[frame++ % DEMO_FRAMES.length]
      const timer = setTimeout(
        () => {
          timers.delete(timer)
          dispatch({
            type: 'takeSucceeded',
            id,
            output: { kind: 'image', url, fileName: `${id}.jpg` }
          })
        },
        DEMO_RENDER_MS + index * 400
      )
      timers.add(timer)
    })
  }

  function cancel() {
    timers.forEach(clearTimeout)
    timers.clear()
    dispatch({ type: 'rendersCancelled' })
  }

  onScopeDispose(cancel)

  return {
    reel: readonly(reel),
    gate,
    session: shallowRef<WorkshopSession>(),
    rendering,
    generate,
    cancel,
    select: (id: string) => dispatch({ type: 'selected', id })
  }
}
