import { describe, expect, it } from 'vitest'

import type { MissingModelDownloadState } from '@/platform/workflowErrors/missingModel/missingModelDownloadState'
import { groupMissingModelCandidates } from '@/platform/workflowErrors/missingModel/missingModelGrouping'
import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'
import {
  deriveMissingResourcesToastState,
  isTrackedModelRelevant,
  nextDownloadBatch,
  toUnavailableModels
} from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import type { TrackedModel } from '@/platform/workflowErrors/missingResources/missingResourcesToastState'

const GATED_REPO = 'https://huggingface.co/org/gated'

let nextKey = 0

function tracked(
  download: MissingModelDownloadState,
  overrides: Partial<TrackedModel> = {}
): TrackedModel {
  nextKey += 1
  return {
    key: `model-${nextKey}`,
    model: {
      name: 'model.safetensors',
      url: 'https://huggingface.co/org/repo/resolve/main/model.safetensors',
      directory: 'checkpoints'
    },
    download,
    stillMissing: true,
    sizeBytes: 100,
    gatedRepoUrl: undefined,
    ...overrides
  }
}

function downloading(
  fraction: number | null,
  paused = false
): MissingModelDownloadState {
  return {
    status: 'downloading',
    paused,
    receivedBytes: null,
    totalBytes: null,
    fraction
  }
}

describe('deriveMissingResourcesToastState', () => {
  it('stays hidden while no model is missing', () => {
    expect(deriveMissingResourcesToastState([], 0)).toEqual({
      kind: 'hidden'
    })
  })

  it.for([
    {
      name: 'offers every missing model with its combined size',
      models: [tracked({ status: 'idle' }), tracked({ status: 'idle' })],
      unavailable: 0,
      expected: { missing: 2, pending: 2, sizeBytes: 200 }
    },
    {
      name: 'drops the size when any model size is still unknown',
      models: [
        tracked({ status: 'idle' }),
        tracked({ status: 'idle' }, { sizeBytes: undefined })
      ],
      unavailable: 0,
      expected: { missing: 2, pending: 2, sizeBytes: null }
    },
    {
      name: 'offers failed models again alongside waiting ones',
      models: [tracked({ status: 'failed' }), tracked({ status: 'idle' })],
      unavailable: 0,
      expected: { missing: 2, pending: 2, sizeBytes: 200 }
    },
    {
      name: 'counts a model that is no longer missing as finished',
      models: [
        tracked({ status: 'idle' }, { stillMissing: false }),
        tracked({ status: 'idle' })
      ],
      unavailable: 0,
      expected: { missing: 1, pending: 1, sizeBytes: 100 }
    },
    {
      name: 'offers gated models like any other and counts undownloadable ones as missing',
      models: [
        tracked({ status: 'idle' }),
        tracked({ status: 'idle' }, { gatedRepoUrl: GATED_REPO })
      ],
      unavailable: 1,
      expected: { missing: 3, pending: 2, sizeBytes: 200 }
    }
  ])('$name', ({ models, unavailable, expected }) => {
    expect(deriveMissingResourcesToastState(models, unavailable)).toEqual({
      kind: 'needsDownload',
      ...expected
    })
  })

  it.for([
    {
      name: 'sums only active downloads and offers the models not yet started',
      models: [
        tracked({ status: 'done' }),
        tracked(downloading(0.5)),
        tracked({ status: 'idle' })
      ],
      expected: {
        finished: 0,
        total: 1,
        fraction: 0.5,
        paused: false,
        bytes: { received: 50, total: 100 },
        startable: 1,
        startableBytes: 100
      }
    },
    {
      name: 'treats a queued request as active with no progress',
      models: [tracked({ status: 'requested' })],
      expected: {
        finished: 0,
        total: 1,
        fraction: 0,
        paused: false,
        bytes: { received: 0, total: 100 },
        startable: 0,
        startableBytes: null
      }
    },
    {
      name: 'counts paused downloads and reports paused only when every active download is paused',
      models: [
        tracked(downloading(0.2, true)),
        tracked(downloading(0.6, true)),
        tracked({ status: 'failed' })
      ],
      expected: {
        finished: 0,
        total: 2,
        fraction: 0.4,
        paused: true,
        bytes: { received: 80, total: 200 },
        startable: 1,
        startableBytes: 100
      }
    },
    {
      name: 'stays unpaused while another download is still running',
      models: [tracked(downloading(0.2, true)), tracked({ status: 'pending' })],
      expected: {
        finished: 0,
        total: 2,
        fraction: 0.1,
        paused: false,
        bytes: { received: 20, total: 200 },
        startable: 0,
        startableBytes: null
      }
    },
    {
      name: 'tracks a gated download and still offers the gated model not yet started',
      models: [
        tracked(downloading(0.5), { gatedRepoUrl: GATED_REPO }),
        tracked({ status: 'idle' }, { gatedRepoUrl: GATED_REPO })
      ],
      expected: {
        finished: 0,
        total: 1,
        fraction: 0.5,
        paused: false,
        bytes: { received: 50, total: 100 },
        startable: 1,
        startableBytes: 100
      }
    }
  ])('$name', ({ models, expected }) => {
    expect(deriveMissingResourcesToastState(models, 0)).toEqual({
      kind: 'downloading',
      ...expected
    })
  })

  it('keeps a model that finished during the running batch in the totals', () => {
    const finished = tracked({ status: 'done' })
    const running = tracked(downloading(0.5))

    expect(
      deriveMissingResourcesToastState(
        [finished, running],
        0,
        new Map([
          [finished.key, 'active' as const],
          [running.key, 'active' as const]
        ])
      )
    ).toMatchObject({
      kind: 'downloading',
      finished: 1,
      total: 2,
      fraction: 0.75,
      bytes: { received: 150, total: 200 }
    })
  })

  it.for([
    {
      name: 'prefers the host-reported size and bytes over the metadata size',
      models: [
        tracked(
          {
            status: 'downloading',
            paused: false,
            receivedBytes: 30,
            totalBytes: 400,
            fraction: 0.075
          },
          { sizeBytes: 100 }
        )
      ],
      expected: { received: 30, total: 400 }
    },
    {
      name: 'drops the byte totals while any model size is unknown',
      models: [
        tracked(downloading(0.5)),
        tracked(downloading(0.5), { sizeBytes: undefined })
      ],
      expected: null
    }
  ])('$name', ({ models, expected }) => {
    const state = deriveMissingResourcesToastState(models, 0)
    expect(state.kind === 'downloading' && state.bytes).toEqual(expected)
  })

  it.for([
    {
      name: 'reports failures once nothing else is left to start',
      models: [tracked({ status: 'failed' }), tracked({ status: 'done' })],
      unavailable: 1,
      expected: { kind: 'failed', failed: 1 }
    },
    {
      name: 'reports a gated model that failed, e.g. without access, as a failure',
      models: [
        tracked({ status: 'done' }),
        tracked({ status: 'failed' }, { gatedRepoUrl: GATED_REPO })
      ],
      unavailable: 1,
      expected: { kind: 'failed', failed: 1 }
    },
    {
      name: 'asks for attention when only undownloadable models remain',
      models: [tracked({ status: 'done' })],
      unavailable: 1,
      expected: { kind: 'needsAttention', count: 1 }
    },
    {
      name: 'asks for attention when no listed model can be downloaded',
      models: [],
      unavailable: 2,
      expected: { kind: 'needsAttention', count: 2 }
    },
    {
      name: 'is ready when a model that failed is no longer needed',
      models: [
        tracked({ status: 'done' }),
        tracked({ status: 'failed' }, { stillMissing: false })
      ],
      unavailable: 0,
      expected: { kind: 'ready' }
    },
    {
      name: 'is ready once every model has finished',
      models: [
        tracked({ status: 'done' }),
        tracked({ status: 'idle' }, { stillMissing: false })
      ],
      unavailable: 0,
      expected: { kind: 'ready' }
    }
  ])('$name', ({ models, unavailable, expected }) => {
    expect(deriveMissingResourcesToastState(models, unavailable)).toEqual(
      expected
    )
  })
})

describe('isTrackedModelRelevant', () => {
  it.for([
    {
      name: 'a model still missing',
      model: tracked({ status: 'idle' }),
      expected: true
    },
    {
      name: 'a model downloaded in this session',
      model: tracked({ status: 'done' }, { stillMissing: false }),
      expected: true
    },
    {
      name: 'a download still running after the model left the workflow',
      model: tracked(downloading(0.5), { stillMissing: false }),
      expected: true
    },
    {
      name: 'a model the workflow no longer needs that was never downloaded',
      model: tracked({ status: 'idle' }, { stillMissing: false }),
      expected: false
    },
    {
      name: 'a failed download the workflow no longer needs',
      model: tracked({ status: 'failed' }, { stillMissing: false }),
      expected: false
    }
  ])('keeps listing $name: $expected', ({ model, expected }) => {
    expect(isTrackedModelRelevant(model)).toBe(expected)
  })
})

describe('nextDownloadBatch', () => {
  function runBatch(...steps: TrackedModel[][]) {
    return steps.reduce<ReturnType<typeof nextDownloadBatch>>(
      (batch, models) => nextDownloadBatch(batch, models),
      new Map()
    )
  }

  it('collects active downloads and keeps those that finish while others run', () => {
    const first = tracked(downloading(0.5))
    const second = tracked({ status: 'pending' })
    const firstDone = { ...first, download: { status: 'done' as const } }

    expect([...runBatch([first, second], [firstDone, second]).keys()]).toEqual([
      first.key,
      second.key
    ])
  })

  it('keeps a finished model in the batch once the rescan no longer lists it', () => {
    const running = tracked(downloading(0.5))
    const first = tracked(downloading(0.9))
    const done = { ...first, download: { status: 'done' as const } }
    const settled = { ...done, stillMissing: false }

    const batch = runBatch(
      [first, running],
      [done, running],
      [settled, running]
    )

    expect([...batch.keys()]).toEqual([first.key, running.key])
    expect(
      deriveMissingResourcesToastState([settled, running], 0, batch)
    ).toMatchObject({ kind: 'downloading', finished: 1, total: 2 })
  })

  it.for([
    { name: 'cancelled', after: { status: 'idle' as const } },
    { name: 'failed', after: { status: 'failed' as const } }
  ])('drops a $name download from the batch', ({ after }) => {
    const stopped = tracked(downloading(0.5))
    const running = tracked(downloading(0.5))

    expect([
      ...runBatch(
        [stopped, running],
        [{ ...stopped, download: after }, running]
      ).keys()
    ]).toEqual([running.key])
  })

  it('empties once nothing is downloading', () => {
    const first = tracked(downloading(0.5))
    const done = { ...first, download: { status: 'done' as const } }
    expect(runBatch([first], [done]).size).toBe(0)
  })
})

describe('toUnavailableModels', () => {
  function candidate(
    overrides: Partial<MissingModelCandidate>
  ): MissingModelCandidate {
    return {
      isAssetSupported: false,
      isMissing: true,
      name: 'model.safetensors',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      nodeId: '1',
      ...overrides
    }
  }

  it('lists only models without a usable download URL, with the reason', () => {
    const groups = groupMissingModelCandidates(
      [
        candidate({
          name: 'downloadable.safetensors',
          directory: 'vae',
          url: 'https://huggingface.co/org/repo/resolve/main/downloadable.safetensors'
        }),
        candidate({ name: 'no-url.safetensors', directory: 'checkpoints' }),
        candidate({
          name: 'elsewhere.safetensors',
          directory: 'loras',
          url: 'https://example.com/elsewhere.safetensors'
        }),
        candidate({
          name: 'notes.txt',
          directory: 'loras',
          url: 'https://huggingface.co/org/repo/resolve/main/notes.txt'
        }),
        candidate({
          name: 'folderless.safetensors',
          url: 'https://huggingface.co/org/repo/resolve/main/folderless.safetensors'
        })
      ],
      false
    )

    expect(
      toUnavailableModels(groups).map(({ name, directory, reason }) => ({
        name,
        directory,
        reason
      }))
    ).toEqual(
      expect.arrayContaining([
        {
          name: 'no-url.safetensors',
          directory: 'checkpoints',
          reason: 'noUrl'
        },
        {
          name: 'elsewhere.safetensors',
          directory: 'loras',
          reason: 'unsupportedSource'
        },
        {
          name: 'notes.txt',
          directory: 'loras',
          reason: 'unsupportedFile'
        },
        {
          name: 'folderless.safetensors',
          directory: null,
          reason: 'noDirectory'
        }
      ])
    )
    expect(toUnavailableModels(groups)).toHaveLength(4)
  })
})
