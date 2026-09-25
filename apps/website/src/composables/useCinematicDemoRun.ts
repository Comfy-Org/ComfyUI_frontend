import { useMounted } from '@vueuse/core'
import { computed, onScopeDispose, readonly, shallowRef } from 'vue'

import type { ShotRequest } from './useCinematicStudioRun'
import type { RunFailure } from '../config/workshop-run'
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
const SLOW_RENDER_MS = 45_000

const DEMO_FAILURES: Readonly<Record<string, RunFailure>> = {
  fail: 'provider',
  policy: 'policy',
  credits: 'noCredits'
}

interface DemoShot {
  readonly video?: ShotRequest['video']
  readonly modelSlug: string
  readonly prompt: string
  readonly aspect: AspectRatio
  readonly takes: number
  readonly preview?: string
}

function demoScenario(): string | null {
  return typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('demo')
}

export function isCinematicDemo(): boolean {
  return demoScenario() !== null
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

  function settle(
    id: string,
    index: number,
    scenario: string | null,
    video: boolean
  ) {
    const failure = scenario ? DEMO_FAILURES[scenario] : undefined
    if (failure && index === 0) {
      dispatch({ type: 'takeFailed', id, reason: failure, requestId: id })
      return
    }
    const url = video
      ? '/animations/scene-3/assets/dusk_mountains.webm'
      : DEMO_FRAMES[frame++ % DEMO_FRAMES.length]
    dispatch({
      type: 'takeSucceeded',
      id,
      output: {
        kind: video ? 'video' : 'image',
        url,
        fileName: `${id}.${video ? 'webm' : 'jpg'}`,
        nsfw: scenario === 'nsfw' && index === 0
      }
    })
  }

  function generate(shot: DemoShot) {
    if (rendering.value) return
    const scenario = demoScenario()
    const ids = Array.from({ length: shot.takes }, () => crypto.randomUUID())
    dispatch({
      type: 'shotStarted',
      ids,
      prompt: shot.prompt,
      modelSlug: shot.modelSlug,
      aspect: shot.aspect,
      startedAt: Date.now(),
      preview: shot.preview
    })
    const renderMs = scenario === 'slow' ? SLOW_RENDER_MS : DEMO_RENDER_MS
    ids.forEach((id, index) => {
      const timer = setTimeout(
        () => {
          timers.delete(timer)
          settle(id, index, scenario, !!shot.video)
        },
        renderMs + index * 1200
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
