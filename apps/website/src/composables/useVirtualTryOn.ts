import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import type { Locale } from '@/i18n/translations'
import { imageSize } from '@/lib/workshop/image-size'
import type {
  TryOnFit,
  TryOnResult
} from '@/lib/workshop/virtual-try-on/contract'
import { DEFAULT_FIT } from '@/lib/workshop/virtual-try-on/contract'
import { vc } from '@/lib/workshop/virtual-try-on/copy'
import type { TryOnGarment } from '@/lib/workshop/virtual-try-on/garments'
import {
  EXAMPLE_GARMENTS,
  UPLOAD_FABRIC
} from '@/lib/workshop/virtual-try-on/garments'
import { TRY_ON_PEOPLE, runTryOn } from '@/lib/workshop/virtual-try-on/mock-run'
import { useSnapshotHistory } from './useSnapshotHistory'

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

export type TryOnTray = 'garment' | 'fit' | 'seed'

const START: Omit<TryOnSetup, 'garment'> = { fit: DEFAULT_FIT, seed: 7 }

/** Virtual try-on's page state. The run itself is `runTryOn`, mocked. */
export function useVirtualTryOn(locale: Locale = 'en') {
  const examples: readonly TryOnGarment[] = EXAMPLE_GARMENTS.map((garment) => ({
    ...garment,
    name: vc(`tryOn.garment.${garment.id}`, locale)
  }))
  const person = shallowRef<TryOnImage>()
  const removed = shallowRef<TryOnImage>()
  const history = useSnapshotHistory<TryOnSetup>({
    ...START,
    garment: examples[0]
  })
  const setup = history.state
  const phase = shallowRef<TryOnPhase>({ kind: 'editing' })
  const tray = ref<TryOnTray>()
  const comparing = ref(false)
  const uploads: string[] = []
  let pendingPerson: string | undefined
  let run: AbortController | undefined

  const garment = computed(() => setup.value.garment)
  const garments = computed(() => {
    const current = garment.value
    return current && !examples.some(({ id }) => id === current.id)
      ? [...examples, current]
      : examples
  })
  /** The garment the run still needs; the person comes first, from the stage. */
  const missing = computed(() => (garment.value ? undefined : 'garment'))
  const canRun = computed(
    () =>
      Boolean(person.value) && phase.value.kind !== 'running' && !missing.value
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
    history.change({ ...setup.value, ...next }, key)
  }

  function keepUpload(url: string) {
    uploads.push(url)
    return url
  }

  async function usePersonFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    pendingPerson = url
    const size = await imageSize(url)
    if (pendingPerson !== url || !size) {
      URL.revokeObjectURL(url)
      return
    }
    showPerson({ url: keepUpload(url), name: file.name, ...size })
  }

  function showPerson(next: TryOnImage) {
    pendingPerson = undefined
    run?.abort()
    leaveResult({ kind: 'editing' })
    removed.value = undefined
    person.value = next
  }

  function useExample(id: string = TRY_ON_PEOPLE[0].id) {
    const example = TRY_ON_PEOPLE.find((option) => option.id === id)
    if (example) showPerson(example.image)
  }

  function removePerson() {
    if (!person.value) return
    run?.abort()
    leaveResult({ kind: 'editing' })
    removed.value = person.value
    person.value = undefined
  }

  function restorePerson() {
    if (!removed.value) return
    person.value = removed.value
    removed.value = undefined
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

  async function tryOn() {
    const current = garment.value
    const model = person.value
    if (!current || !model || !canRun.value) return
    tray.value = undefined
    const controller = new AbortController()
    run = controller
    leaveResult({ kind: 'running', startedAt: Date.now() })
    const { fit, seed } = setup.value
    try {
      const result = await runTryOn(
        { person: model.url, garment: current.url, fit, seed },
        controller.signal
      )
      if (run === controller) {
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
    removed,
    useExample,
    removePerson,
    restorePerson,
    setup,
    garment,
    garments,
    phase,
    tray,
    comparing,
    missing,
    canRun,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    usePersonFile,
    useGarmentFile,
    pickGarment,
    removeGarment,
    setFit,
    setSeed,
    undo: history.undo,
    redo: history.redo,
    tryOn,
    cancel,
    edit,
    toggleTray
  }
}

export type VirtualTryOn = ReturnType<typeof useVirtualTryOn>
