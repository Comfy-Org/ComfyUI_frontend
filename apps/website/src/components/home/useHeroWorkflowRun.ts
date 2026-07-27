import { useRafFn } from '@vueuse/core'
import { ref } from 'vue'

import type { WorkflowNodeId } from './heroWorkflowGraph'

export const RENDER_COUNT = 50

export function renderSrc(index: number): string {
  return `/images/hero/renders/render-${String(index + 1).padStart(2, '0')}.webp`
}

// The seed is what the user sees; the render shown is seed % RENDER_COUNT.
// Nudging the seed when it lands on the previous bucket guarantees a fresh
// image on every consecutive run.
export function pickSeed(
  random: () => number,
  lastIndex: number | null
): number {
  const seed = Math.floor(random() * 999_999_999)
  return seed % RENDER_COUNT === lastIndex ? seed + 1 : seed
}

// Fake execution timeline: loaders warm up quickly, then the sampler carries
// most of the run — mirroring how the real workflow feels in ComfyUI.
const RUN_STEPS: { id: WorkflowNodeId; duration: number }[] = [
  { id: 'model', duration: 600 },
  { id: 'clip', duration: 450 },
  { id: 'vae', duration: 400 },
  { id: 'lora', duration: 550 },
  { id: 'seed', duration: 300 },
  { id: 'output', duration: 1700 }
]

const TOTAL_DURATION = RUN_STEPS.reduce((sum, s) => sum + s.duration, 0)

export type RunPhase = 'idle' | 'running' | 'done'
export type NodeRunState = 'idle' | 'running' | 'done'

export function useHeroWorkflowRun() {
  const phase = ref<RunPhase>('idle')
  const seed = ref(52)
  const activeNode = ref<WorkflowNodeId | null>(null)
  const nodeProgress = ref(0)
  const totalProgress = ref(0)
  const outputSrc = ref<string | null>(null)

  let elapsed = 0
  let pendingIndex: number | null = null
  let imageReady = false

  const { pause, resume } = useRafFn(({ delta }) => advance(delta), {
    immediate: false
  })

  function advance(delta: number) {
    // Cap long frames (background tab) so the run never skips visibly.
    elapsed += Math.min(delta, 100)
    let start = 0
    for (const step of RUN_STEPS) {
      if (elapsed < start + step.duration) {
        activeNode.value = step.id
        nodeProgress.value = (elapsed - start) / step.duration
        totalProgress.value = elapsed / TOTAL_DURATION
        return
      }
      start += step.duration
    }
    if (!imageReady) {
      // Hold just short of done until the render finishes downloading.
      activeNode.value = 'output'
      nodeProgress.value = 0.96
      totalProgress.value = 0.96
      return
    }
    pause()
    phase.value = 'done'
    activeNode.value = null
    nodeProgress.value = 0
    totalProgress.value = 1
    outputSrc.value = pendingIndex === null ? null : renderSrc(pendingIndex)
  }

  function run() {
    if (phase.value === 'running') return
    const nextSeed = pickSeed(Math.random, pendingIndex)
    seed.value = nextSeed
    pendingIndex = nextSeed % RENDER_COUNT
    imageReady = false
    const image = new Image()
    image.onload = () => {
      imageReady = true
    }
    image.onerror = () => {
      imageReady = true
    }
    image.src = renderSrc(pendingIndex)
    elapsed = 0
    totalProgress.value = 0
    phase.value = 'running'
    resume()
  }

  function nodeState(id: WorkflowNodeId): NodeRunState {
    if (activeNode.value === id) return 'running'
    if (phase.value === 'done') return 'done'
    if (phase.value !== 'running') return 'idle'
    const activeIndex = RUN_STEPS.findIndex((s) => s.id === activeNode.value)
    const index = RUN_STEPS.findIndex((s) => s.id === id)
    return index < activeIndex ? 'done' : 'idle'
  }

  return {
    phase,
    seed,
    activeNode,
    nodeProgress,
    totalProgress,
    outputSrc,
    run,
    nodeState
  }
}

export type HeroWorkflowRun = ReturnType<typeof useHeroWorkflowRun>
