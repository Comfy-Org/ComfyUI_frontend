import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it } from 'vitest'

import { useMissingModelDownloadStore } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import type { MissingMediaCandidate } from '@/platform/workflowErrors/missingMedia/types'
import { useMissingModelsToastCoverage } from '@/platform/workflowErrors/missingResources/useMissingModelsToastCoverage'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

function installDesktopHost({ remote = false } = {}) {
  window.__comfyDesktop2 = {
    isRemote: () => remote,
    downloadModel: async () => true,
    onDownloadProgress: () => () => {}
  }
}

function seedMissingModel() {
  useMissingModelStore().setMissingModels([
    fromPartial<MissingModelCandidate>({
      name: 'model.safetensors',
      directory: 'checkpoints',
      isMissing: true
    })
  ])
}

describe(useMissingModelsToastCoverage, () => {
  beforeEach(() => {
    delete window.__comfyDesktop2
  })

  it('covers a models-only workflow while the local Desktop host reports progress', () => {
    installDesktopHost()
    useMissingModelDownloadStore().startTracking()
    seedMissingModel()

    expect(useMissingModelsToastCoverage().coveredByToast.value).toBe(true)
  })

  it.for([
    {
      name: 'in the browser',
      arrange: () => {}
    },
    {
      name: 'on a remote Desktop host',
      arrange: () => {
        installDesktopHost({ remote: true })
        useMissingModelDownloadStore().startTracking()
      }
    },
    {
      name: 'before the Desktop host reports progress',
      arrange: () => installDesktopHost()
    }
  ])('leaves missing models to the overlay $name', ({ arrange }) => {
    arrange()
    seedMissingModel()

    expect(useMissingModelsToastCoverage().coveredByToast.value).toBe(false)
  })

  it.for([
    {
      name: 'missing nodes',
      addIssue: () =>
        useMissingNodesErrorStore().setMissingNodeTypes(['UnknownNode'])
    },
    {
      name: 'missing media',
      addIssue: () =>
        useMissingMediaStore().setMissingMedia([
          fromPartial<MissingMediaCandidate>({
            name: 'photo.png',
            isMissing: true
          })
        ])
    },
    {
      name: 'an execution error',
      addIssue: () =>
        useExecutionErrorStore().recordExecutionError(
          fromPartial({ node_id: '1', exception_message: 'boom' })
        )
    }
  ])(
    'leaves the workflow to the overlay when it also has $name',
    ({ addIssue }) => {
      installDesktopHost()
      useMissingModelDownloadStore().startTracking()
      seedMissingModel()
      addIssue()

      expect(useMissingModelsToastCoverage().coveredByToast.value).toBe(false)
    }
  )

  it('covers nothing when the workflow has no missing models', () => {
    installDesktopHost()
    useMissingModelDownloadStore().startTracking()

    expect(useMissingModelsToastCoverage().coveredByToast.value).toBe(false)
  })
})
