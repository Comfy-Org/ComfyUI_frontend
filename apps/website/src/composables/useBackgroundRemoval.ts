import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import type {
  CutoutResult,
  CutoutSetup
} from '../lib/workshop/background-removal/contract'
import {
  DEFAULT_SETUP,
  cutoutRequest
} from '../lib/workshop/background-removal/contract'
import { CUTOUT_EXAMPLE } from '../lib/workshop/background-removal/mask'
import { runCutout } from '../lib/workshop/background-removal/mock-run'
import { useEditorImage } from './useEditorImage'
import { useSnapshotHistory } from './useSnapshotHistory'

type CutoutPhase =
  | { readonly kind: 'editing' }
  | { readonly kind: 'running'; readonly startedAt: number }
  | { readonly kind: 'done'; readonly result: CutoutResult }
  | { readonly kind: 'failed' }

export type CutoutTray = 'background' | 'format' | 'advanced'

/** Background Removal's page state. The run is `runCutout`, mocked for now. */
export function useBackgroundRemoval() {
  const history = useSnapshotHistory<CutoutSetup>(DEFAULT_SETUP)
  const phase = shallowRef<CutoutPhase>({ kind: 'editing' })
  const tray = ref<CutoutTray>()
  const touched = ref(false)
  let run: AbortController | undefined

  function releaseResult(url: string) {
    if (url.startsWith('blob:') && url !== image.value?.url)
      URL.revokeObjectURL(url)
  }

  function leaveResult(next: CutoutPhase) {
    const current = phase.value
    if (current.kind === 'done') releaseResult(current.result.url)
    phase.value = next
  }

  const { image, useExample, useFile } = useEditorImage(() => {
    run?.abort()
    run = undefined
    leaveResult({ kind: 'editing' })
    history.reset(DEFAULT_SETUP)
    touched.value = false
  })

  const canRun = computed(
    () => Boolean(image.value) && phase.value.kind !== 'running'
  )

  function update(patch: Partial<CutoutSetup>, key?: string) {
    touched.value = true
    history.change({ ...history.state.value, ...patch }, key)
  }

  async function removeBackground() {
    const current = image.value
    if (!current || !canRun.value) return
    tray.value = undefined
    const controller = new AbortController()
    run = controller
    leaveResult({ kind: 'running', startedAt: Date.now() })
    try {
      const result = await runCutout(
        cutoutRequest(current.url, history.state.value),
        controller.signal
      )
      if (run === controller) phase.value = { kind: 'done', result }
      else releaseResult(result.url)
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

  function toggleTray(next: CutoutTray) {
    tray.value = tray.value === next ? undefined : next
  }

  tryOnScopeDispose(() => {
    run?.abort()
    leaveResult({ kind: 'editing' })
  })

  return {
    image,
    setup: history.state,
    phase,
    tray,
    touched,
    canRun,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    useExample: () => useExample(CUTOUT_EXAMPLE),
    useFile,
    update,
    undo: history.undo,
    redo: history.redo,
    removeBackground,
    cancel,
    edit: () => leaveResult({ kind: 'editing' }),
    toggleTray
  }
}

export type BackgroundRemoval = ReturnType<typeof useBackgroundRemoval>
