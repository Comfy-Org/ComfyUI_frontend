import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useTemplateInputDownloadStore } from '@/platform/workflow/templates/stores/templateInputDownloadStore'
import { createMissingMediaCandidate } from '@/platform/workflowErrors/missingMedia/__fixtures__/promotedMedia'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'
import type { MissingResourcesToastState } from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import { useCloseOverlayCoveredByToast } from '@/platform/workflowErrors/missingResources/useCloseOverlayCoveredByToast'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

const MODEL_NAME = 'model.safetensors'
const MEDIA_NAME = 'photo.png'

function seedMissingModel() {
  useMissingModelStore().setMissingModels([
    fromPartial<MissingModelCandidate>({
      nodeId: '1',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name: MODEL_NAME,
      directory: 'checkpoints',
      isMissing: true
    })
  ])
}

function seedMissingMedia() {
  useMissingMediaStore().setMissingMedia([
    createMissingMediaCandidate([toNodeId(2)], { name: MEDIA_NAME })
  ])
}

function watchOverlay(
  initialKind: MissingResourcesToastState['kind'] = 'needsDownload'
) {
  const toastKind = ref(initialKind)
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const { forgetHeldOverlay } = scope.run(() =>
    useCloseOverlayCoveredByToast(() => toastKind.value)
  )!
  return { toastKind, forgetHeldOverlay }
}

async function openOverlay() {
  useExecutionErrorStore().showErrorOverlay()
  await nextTick()
}

describe(useCloseOverlayCoveredByToast, () => {
  beforeEach(() => {
    useSettingStore().settingValues['Comfy.RightSidePanel.ShowErrorsTab'] = true
    seedMissingModel()
  })

  it.for(['needsDownload', 'downloading', 'failed', 'needsAttention'] as const)(
    'closes an overlay that opens while the toast lists every missing model as %s',
    async (kind) => {
      watchOverlay(kind)

      await openOverlay()

      expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(false)
    }
  )

  it('closes an overlay that only repeats a run blocked by the missing model', async () => {
    useExecutionErrorStore().recordNodeErrors({
      '1': nodeError([
        validationError('value_not_in_list', 'ckpt_name', {
          received_value: MODEL_NAME
        })
      ])
    })
    watchOverlay()

    await openOverlay()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(false)
  })

  it.for([
    {
      name: 'the toast is hidden',
      arrange: () => watchOverlay('hidden')
    },
    {
      name: 'the toast reports the models ready',
      arrange: () => watchOverlay('ready')
    },
    {
      name: 'nodes are missing too',
      arrange: () => {
        useMissingNodesErrorStore().setMissingNodeTypes(['UnknownNode'])
        watchOverlay()
      }
    },
    {
      name: 'media is missing too',
      arrange: () => {
        seedMissingMedia()
        watchOverlay()
      }
    },
    {
      name: 'missing media is still downloading with the template',
      arrange: () => {
        seedMissingMedia()
        useTemplateInputDownloadStore().updateProgress({
          downloadId: 'input-1',
          filename: MEDIA_NAME,
          progress: 0.5,
          status: 'downloading',
          templateInputs: []
        })
        watchOverlay()
      }
    },
    {
      name: 'the run failed on another error',
      arrange: () => {
        useExecutionErrorStore().recordNodeErrors({
          '1': nodeError([validationError('required_input_missing', 'model')])
        })
        watchOverlay()
      }
    }
  ])('keeps the overlay open when $name', async ({ arrange }) => {
    arrange()

    await openOverlay()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })

  it('leaves an open overlay open when its other issues clear', async () => {
    useMissingNodesErrorStore().setMissingNodeTypes(['UnknownNode'])
    watchOverlay()
    await openOverlay()

    useMissingNodesErrorStore().setMissingNodeTypes([])
    await nextTick()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })

  it('lets the overlay open again once the toast is dismissed', async () => {
    const { toastKind } = watchOverlay()
    await openOverlay()

    toastKind.value = 'hidden'
    await openOverlay()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })

  it('reopens the overlay it closed when another issue appears without opening it', async () => {
    watchOverlay()
    await openOverlay()

    seedMissingMedia()
    await nextTick()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })

  it('keeps the overlay closed when only the toast is dismissed', async () => {
    const { toastKind } = watchOverlay()
    await openOverlay()

    toastKind.value = 'hidden'
    await nextTick()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(false)
  })

  it('keeps holding the overlay after the covered models resolve, as an open overlay would stay open', async () => {
    watchOverlay()
    await openOverlay()

    useMissingModelStore().setMissingModels([])
    await nextTick()
    seedMissingMedia()
    await nextTick()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })

  it('forgets the held overlay when the user dismisses the toast', async () => {
    const { toastKind, forgetHeldOverlay } = watchOverlay()
    await openOverlay()

    toastKind.value = 'hidden'
    forgetHeldOverlay()
    seedMissingMedia()
    await nextTick()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(false)
  })

  it('leaves an open overlay alone when the user dismisses the toast', async () => {
    useMissingNodesErrorStore().setMissingNodeTypes(['UnknownNode'])
    const { forgetHeldOverlay } = watchOverlay()
    await openOverlay()

    forgetHeldOverlay()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })
})
