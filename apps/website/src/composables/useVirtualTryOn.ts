import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import type { Locale } from '../i18n/translations'
import { imageSize } from '../lib/workshop/image-size'
import { vc } from '../lib/workshop/virtual-try-on/copy'
import type {
  TryOnFit,
  TryOnGarment
} from '../lib/workshop/virtual-try-on/garments'
import {
  EXAMPLE_GARMENTS,
  UPLOAD_FABRIC
} from '../lib/workshop/virtual-try-on/garments'
import type { TryOnResult } from '../lib/workshop/virtual-try-on/mock-run'
import {
  TRY_ON_PERSON,
  runTryOn,
  tryOnRequest
} from '../lib/workshop/virtual-try-on/mock-run'

export interface TryOnImage {
  readonly url: string
  readonly name: string
  readonly width: number
  readonly height: number
}

/** Everything undo and redo cover. */
interface TryOnSetup {
  readonly garment?: TryOnGarment
  readonly fit: TryOnFit
  readonly seed: number
}

type TryOnPhase =
  | { readonly kind: 'editing' }
  | { readonly kind: 'running'; readonly startedAt: number }
  | { readonly kind: 'done'; readonly result: TryOnResult }
  | { readonly kind: 'failed' }

export type TryOnTray = 'garment' | 'fit' | 'advanced'
type TryOnView = 'compare' | 'result'

const START: Omit<TryOnSetup, 'garment'> = { fit: 'regular', seed: 7 }

/** Virtual try-on's page state. The run itself is `runTryOn`, mocked. */
export function useVirtualTryOn(locale: Locale = 'en') {
  const examples: readonly TryOnGarment[] = EXAMPLE_GARMENTS.map((garment) => ({
    ...garment,
    name: vc(`tryOn.garment.${garment.id}`, locale)
  }))
  const person = shallowRef<TryOnImage>(TRY_ON_PERSON)
  const setup = shallowRef<TryOnSetup>({ ...START, garment: examples[0] })
  const past = shallowRef<TryOnSetup[]>([])
  const future = shallowRef<TryOnSetup[]>([])
  const phase = shallowRef<TryOnPhase>({ kind: 'editing' })
  const tray = ref<TryOnTray>()
  const view = ref<TryOnView>('compare')
  const guide = ref(true)
  const uploads: string[] = []
  let lastEdit: string | undefined
  let pendingPerson: string | undefined
  let run: AbortController | undefined

  const garment = computed(() => setup.value.garment)
  const garments = computed(() => {
    const current = garment.value
    return current && !examples.some(({ id }) => id === current.id)
      ? [...examples, current]
      : examples
  })
  const canRun = computed(
    () => phase.value.kind !== 'running' && Boolean(garment.value)
  )

  function leaveResult(next: TryOnPhase) {
    const current = phase.value
    if (current.kind === 'done' && current.result.url.startsWith('blob:'))
      URL.revokeObjectURL(current.result.url)
    phase.value = next
  }

  /**
   * Call before a change the visitor can undo. Changes that share a `key`
   * in a row (one seed typed digit by digit) undo as one step.
   */
  function change(next: Partial<TryOnSetup>, key?: string) {
    if (!key || key !== lastEdit) {
      past.value = [...past.value, setup.value]
      future.value = []
    }
    lastEdit = key
    setup.value = { ...setup.value, ...next }
  }

  function keepUpload(url: string) {
    uploads.push(url)
    return url
  }

  async function usePersonFile(file: File) {
    const url = URL.createObjectURL(file)
    pendingPerson = url
    const size = await imageSize(url)
    if (pendingPerson !== url || !size) {
      URL.revokeObjectURL(url)
      return
    }
    pendingPerson = undefined
    run?.abort()
    leaveResult({ kind: 'editing' })
    person.value = { url: keepUpload(url), name: file.name, ...size }
  }

  function useGarmentFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const url = keepUpload(URL.createObjectURL(file))
    change({
      garment: { id: url, url, name: file.name, fabric: UPLOAD_FABRIC }
    })
  }

  function pickGarment(id: string) {
    const next = garments.value.find((candidate) => candidate.id === id)
    if (next && next.id !== garment.value?.id) change({ garment: next })
  }

  function removeGarment() {
    if (garment.value) change({ garment: undefined })
  }

  function setFit(fit: TryOnFit) {
    if (fit !== setup.value.fit) change({ fit })
  }

  function setSeed(seed: number) {
    change({ seed }, 'seed')
  }

  function undo() {
    const previous = past.value.at(-1)
    if (!previous) return
    future.value = [setup.value, ...future.value]
    past.value = past.value.slice(0, -1)
    setup.value = previous
    lastEdit = undefined
  }

  function redo() {
    const next = future.value.at(0)
    if (!next) return
    past.value = [...past.value, setup.value]
    future.value = future.value.slice(1)
    setup.value = next
    lastEdit = undefined
  }

  async function tryOn() {
    const current = garment.value
    if (!current || !canRun.value) return
    tray.value = undefined
    const controller = new AbortController()
    run = controller
    leaveResult({ kind: 'running', startedAt: Date.now() })
    const { fit, seed } = setup.value
    try {
      const result = await runTryOn(
        tryOnRequest(person.value.url, current.url, fit, seed),
        controller.signal
      )
      if (run === controller) {
        view.value = 'compare'
        phase.value = { kind: 'done', result }
      } else if (result.url.startsWith('blob:')) URL.revokeObjectURL(result.url)
    } catch {
      if (run === controller && !controller.signal.aborted)
        phase.value = { kind: 'failed' }
    }
  }

  function cancel() {
    run?.abort()
    run = undefined
    phase.value = { kind: 'editing' }
  }

  function edit() {
    leaveResult({ kind: 'editing' })
  }

  function toggleTray(next: TryOnTray) {
    tray.value = tray.value === next ? undefined : next
  }

  tryOnScopeDispose(() => {
    run?.abort()
    pendingPerson = undefined
    leaveResult({ kind: 'editing' })
    uploads.forEach((url) => URL.revokeObjectURL(url))
  })

  return {
    person,
    setup,
    garment,
    garments,
    phase,
    tray,
    view,
    guide,
    canRun,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    usePersonFile,
    useGarmentFile,
    pickGarment,
    removeGarment,
    setFit,
    setSeed,
    undo,
    redo,
    tryOn,
    cancel,
    edit,
    toggleTray
  }
}

export type VirtualTryOn = ReturnType<typeof useVirtualTryOn>
