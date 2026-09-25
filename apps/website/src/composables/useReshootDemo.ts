import { useObjectUrl } from '@vueuse/core'
import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'

import type {
  CameraKey,
  ReshootAspect,
  ReshootCamera,
  ReshootMotion,
  ReshootSize
} from '../lib/workshop/cinematic-studio/reshoot'
import {
  DEFAULT_CAMERA,
  RESHOOT_EXAMPLE,
  withKey
} from '../lib/workshop/cinematic-studio/reshoot'

export type DepthState = 'none' | 'analyzing' | 'ready' | 'stale'

export interface ReshootTake {
  readonly id: string
  readonly n: number
  readonly camera: Readonly<ReshootCamera>
  readonly keys: number
  readonly status: 'rendering' | 'done' | 'cancelled'
  readonly startedAt: number
  readonly url?: string
}

const ANALYZE_MS = 2500
const GENERATE_MS = 6000

const EXAMPLE_TAKE: ReshootTake = {
  id: 'example',
  n: 0,
  camera: DEFAULT_CAMERA,
  keys: 0,
  status: 'done',
  startedAt: 0,
  url: RESHOOT_EXAMPLE.result
}

/**
 * The Re-shoot mock's whole state. Analysis and generation are timers: the
 * page shows the flow of the CrossView app without its deployment, and every
 * take plays the worked example's result.
 */
export function useReshootDemo() {
  const upload = shallowRef<File>()
  const uploadUrl = useObjectUrl(upload)
  const clip = computed(() => uploadUrl.value ?? RESHOOT_EXAMPLE.clip)
  const clipName = computed(() => upload.value?.name ?? RESHOOT_EXAMPLE.name)
  const isExample = computed(() => upload.value === undefined)

  const aspect = ref<ReshootAspect>('source')
  const size = ref<ReshootSize>('480p')
  const depth = ref<DepthState>('none')
  const step = ref<1 | 2>(1)
  const camera = reactive<ReshootCamera>({ ...DEFAULT_CAMERA })
  const keepAim = ref(true)
  const frame = ref(0)
  const keys = ref<CameraKey[]>([])
  const motion = ref<ReshootMotion>('smooth')
  const prompt = ref('')
  const takes = ref<ReshootTake[]>([EXAMPLE_TAKE])
  const selected = ref<string>('example')

  const timers = new Set<ReturnType<typeof setTimeout>>()
  function later(ms: number, run: () => void) {
    const timer = setTimeout(() => {
      timers.delete(timer)
      run()
    }, ms)
    timers.add(timer)
  }
  onScopeDispose(() => timers.forEach(clearTimeout))

  watch([aspect, size], () => {
    if (depth.value === 'ready') depth.value = 'stale'
  })
  watch(upload, () => {
    depth.value = 'none'
    keys.value = []
  })

  const rendering = computed(() =>
    takes.value.some((take) => take.status === 'rendering')
  )
  const current = computed(() =>
    takes.value.find((take) => take.id === selected.value)
  )

  function analyze() {
    depth.value = 'analyzing'
    selected.value = 'aim'
    later(ANALYZE_MS, () => {
      depth.value = 'ready'
      step.value = 2
    })
  }

  function prepare() {
    if (depth.value === 'ready') step.value = 2
    else analyze()
  }

  function back() {
    step.value = 1
    selected.value = 'aim'
  }

  function updateTake(id: string, patch: Partial<ReshootTake>) {
    takes.value = takes.value.map((take) =>
      take.id === id ? { ...take, ...patch } : take
    )
  }

  function generate() {
    const n = takes.value.length
    const id = `take-${n}`
    takes.value = [
      ...takes.value,
      {
        id,
        n,
        camera: { ...camera },
        keys: keys.value.length,
        status: 'rendering',
        startedAt: Date.now()
      }
    ]
    selected.value = id
    later(GENERATE_MS, () => {
      if (takes.value.find((take) => take.id === id)?.status === 'rendering')
        updateTake(id, { status: 'done', url: RESHOOT_EXAMPLE.result })
    })
  }

  function cancel() {
    takes.value = takes.value.map((take) =>
      take.status === 'rendering' ? { ...take, status: 'cancelled' } : take
    )
  }

  function aim(patch: Partial<ReshootCamera>) {
    Object.assign(camera, patch)
    selected.value = 'aim'
  }

  function addKey() {
    keys.value = withKey(keys.value, {
      frame: frame.value,
      camera: { ...camera }
    })
  }

  function removeKey(at: number) {
    keys.value = keys.value.filter((key) => key.frame !== at)
  }

  return {
    upload,
    clip,
    clipName,
    isExample,
    aspect,
    size,
    depth,
    step,
    camera,
    keepAim,
    frame,
    keys,
    motion,
    prompt,
    takes,
    selected,
    current,
    rendering,
    prepare,
    back,
    generate,
    cancel,
    aim,
    addKey,
    removeKey
  }
}
