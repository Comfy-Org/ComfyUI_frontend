import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'
import { useDialogStore } from '@/stores/dialogStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

const overlay = vi.hoisted(() => ({
  isVisible: { value: false },
  downloadableMissingModelGroups: { value: [] as MissingModelGroup[] }
}))

const distribution = vi.hoisted(() => ({ isCloud: false }))
const warnings = vi.hoisted(() => ({ modelsVisible: true }))

vi.mock<unknown>(
  import('@/platform/workflowErrors/overlay/useErrorOverlayState'),
  () => ({ useErrorOverlayState: () => overlay })
)
vi.mock<unknown>(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))
vi.mock<unknown>(
  import('@/platform/settings/missingWarningVisibility'),
  () => ({
    isMissingWarningVisible: () => warnings.modelsVisible
  })
)
vi.mock<unknown>(
  import('@/platform/workflowErrors/missingModel/components/MissingModelsDialogContent.vue'),
  () => ({ default: {} })
)

function groupOf(...names: string[]): MissingModelGroup[] {
  return [
    {
      directory: 'checkpoints',
      isAssetSupported: false,
      models: names.map((name) => ({
        name,
        representative: {
          name,
          nodeId: '1',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          isAssetSupported: false,
          isMissing: true,
          url: `https://huggingface.co/comfy/test/resolve/main/${name}`,
          directory: 'checkpoints'
        },
        referencingNodes: [{ nodeId: '1', widgetName: 'ckpt_name' }]
      }))
    }
  ]
}

async function startOffering() {
  const { useOfferMissingModelsDialog } =
    await import('./useOfferMissingModelsDialog')
  effectScope().run(() => useOfferMissingModelsDialog())
}

async function surface(groups: MissingModelGroup[]) {
  overlay.downloadableMissingModelGroups.value = groups
  overlay.isVisible.value = true
  await nextTick()
}

async function hideOverlay() {
  overlay.isVisible.value = false
  await nextTick()
}

function shownDialogs() {
  return vi
    .mocked(useDialogStore().showDialog)
    .mock.calls.filter(([options]) => options.key === 'missing-models')
}

function lastDialogProps() {
  return shownDialogs().at(-1)?.[0].props as {
    missingModelGroups: MissingModelGroup[]
    onClose: () => void
    onNotNow: () => void
  }
}

describe('useOfferMissingModelsDialog', () => {
  beforeEach(() => {
    vi.resetModules()
    overlay.isVisible = ref(false)
    overlay.downloadableMissingModelGroups = ref([])
    distribution.isCloud = false
    warnings.modelsVisible = true
  })

  it('opens the dialog in place of the overlay when a workflow needs models', async () => {
    await startOffering()
    const groups = groupOf('flux.safetensors')

    await surface(groups)

    expect(shownDialogs()).toHaveLength(1)
    expect(lastDialogProps().missingModelGroups).toEqual(groups)
    expect(useExecutionErrorStore().dismissErrorOverlay).toHaveBeenCalledOnce()
  })

  it('leaves the overlay in charge after Not now, without reopening the dialog', async () => {
    await startOffering()
    await surface(groupOf('flux.safetensors'))

    lastDialogProps().onNotNow()
    await hideOverlay()
    await surface(groupOf('flux.safetensors'))

    expect(
      vi
        .mocked(useDialogStore().closeDialog)
        .mock.calls.filter(([options]) => options?.key === 'missing-models')
    ).toHaveLength(1)
    expect(useExecutionErrorStore().showErrorOverlay).toHaveBeenCalledOnce()
    expect(shownDialogs()).toHaveLength(1)
    expect(useExecutionErrorStore().dismissErrorOverlay).toHaveBeenCalledOnce()
  })

  it('offers again when a workflow needs a model it has not offered', async () => {
    await startOffering()
    await surface(groupOf('flux.safetensors'))
    await hideOverlay()

    await surface(groupOf('flux.safetensors', 'vae.safetensors'))

    expect(shownDialogs()).toHaveLength(2)
  })

  it.for([
    {
      name: 'on Comfy Cloud',
      setup: () => {
        distribution.isCloud = true
      }
    },
    {
      name: 'with missing model warnings turned off',
      setup: () => {
        warnings.modelsVisible = false
      }
    }
  ])('keeps the overlay $name', async ({ setup }) => {
    setup()
    await startOffering()

    await surface(groupOf('flux.safetensors'))

    expect(shownDialogs()).toHaveLength(0)
    expect(useExecutionErrorStore().dismissErrorOverlay).not.toHaveBeenCalled()
  })

  it('keeps the overlay when nothing can be downloaded', async () => {
    await startOffering()

    await surface([])

    expect(shownDialogs()).toHaveLength(0)
  })
})
