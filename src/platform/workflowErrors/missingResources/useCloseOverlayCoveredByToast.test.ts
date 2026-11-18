import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useTemplateInputDownloadStore } from '@/platform/workflow/templates/stores/templateInputDownloadStore'
import { createMissingMediaCandidate } from '@/platform/workflowErrors/missingMedia/__fixtures__/promotedMedia'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'
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

function watchOverlay(toastVisible = true) {
  const visible = ref(toastVisible)
  effectScope().run(() => useCloseOverlayCoveredByToast(() => visible.value))
  return visible
}

async function openOverlay() {
  useExecutionErrorStore().showErrorOverlay()
  await nextTick()
}

describe(useCloseOverlayCoveredByToast, () => {
  beforeEach(() => {
    seedMissingModel()
  })

  it('closes an overlay that opens while the toast lists every missing model', async () => {
    watchOverlay()

    await openOverlay()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(false)
  })

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
      arrange: () => watchOverlay(false)
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

  it('lets the overlay open again once the toast is dismissed', async () => {
    const toastVisible = watchOverlay()
    await openOverlay()

    toastVisible.value = false
    await openOverlay()

    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })
})
