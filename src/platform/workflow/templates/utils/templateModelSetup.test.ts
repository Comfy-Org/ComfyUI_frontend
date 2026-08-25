import { describe, expect, it, vi } from 'vitest'

import type { ModelWithUrl } from '@/platform/missingModel/missingModelDownload'
import type { TemplateModelMetadataBatchResult } from '@/platform/workflow/templates/utils/templateModelMetadata'
import type { ResolvedTemplateModelAvailability } from '@/platform/workflow/templates/utils/templateModelAvailability'
import type { TemplateModelRequirementDetail } from '@/platform/workflow/templates/utils/templateModelRequirements'
import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import { deriveTemplateModelSetup } from './templateModelSetup'

function model(
  name: string,
  directory = 'checkpoints',
  url = `https://example.com/${directory}/${name}`
): ModelFile {
  return { name, directory, url }
}

function requirement(
  model: ModelFile,
  usedBy: readonly string[] = []
): TemplateModelRequirementDetail {
  return { model, usedBy }
}

function resolvedMetadata(
  model: ModelFile,
  fileSize: number | null,
  gatedRepoUrl: string | null = null
) {
  return {
    model,
    fileSize,
    gatedRepoUrl,
    resolution: 'resolved' as const
  }
}

describe('deriveTemplateModelSetup', () => {
  it('derives strict statuses by identity in stable requirement order', () => {
    const manual = model('manual.safetensors')
    const installed = model('installed.safetensors')
    const inventoryUnknown = model('inventory-unknown.safetensors')
    const metadataFailed = model('metadata-failed.safetensors')
    const downloadable = model('downloadable.safetensors')
    const unavailable = model('unsupported.safetensors')
    const requirements = [
      requirement(manual, ['Manual Loader']),
      requirement(installed, ['Installed Loader']),
      requirement(inventoryUnknown, ['Unknown Loader']),
      requirement(metadataFailed, ['Failed Loader']),
      requirement(downloadable, ['Download Loader']),
      requirement(unavailable, ['Unsupported Loader'])
    ]
    const availability: ResolvedTemplateModelAvailability[] = [
      { model: unavailable, status: 'missing' },
      { model: inventoryUnknown, status: 'unknown' },
      { model: installed, status: 'installed' },
      { model: downloadable, status: 'missing' },
      { model: metadataFailed, status: 'missing' },
      { model: manual, status: 'missing' }
    ]
    const manualHref = 'https://metadata-resolver.example/gated-model'
    const metadata: TemplateModelMetadataBatchResult = {
      status: 'completed',
      entries: [
        resolvedMetadata(unavailable, 60),
        resolvedMetadata(manual, 10, manualHref),
        {
          model: metadataFailed,
          fileSize: null,
          gatedRepoUrl: null,
          resolution: 'failed'
        },
        resolvedMetadata(downloadable, 50),
        resolvedMetadata(installed, 20),
        resolvedMetadata(inventoryUnknown, 30, manualHref)
      ]
    }
    const isDownloadable = vi.fn(
      (candidate: ModelWithUrl) => candidate.name === downloadable.name
    )

    const result = deriveTemplateModelSetup(
      requirements,
      availability,
      metadata,
      { isDownloadable }
    )

    expect(
      result.rows.map(({ model, status }) => [model.name, status])
    ).toEqual([
      [manual.name, 'manual'],
      [installed.name, 'installed'],
      [inventoryUnknown.name, 'unknown'],
      [metadataFailed.name, 'unknown'],
      [downloadable.name, 'downloadable'],
      [unavailable.name, 'unavailable']
    ])
    expect(result.rows[0]).toMatchObject({
      model: manual,
      usedBy: ['Manual Loader'],
      fileSize: 10,
      modelType: { kind: 'known', key: 'checkpoint' },
      status: 'manual',
      href: manualHref
    })
    expect(result.rows[2]).not.toHaveProperty('href')
    expect(isDownloadable).toHaveBeenCalledTimes(2)
    expect(isDownloadable).toHaveBeenNthCalledWith(1, downloadable)
    expect(isDownloadable).toHaveBeenNthCalledWith(2, unavailable)
  })

  it.for<{
    label: string
    metadata: TemplateModelMetadataBatchResult
  }>([
    { label: 'an aborted metadata batch', metadata: { status: 'aborted' } },
    {
      label: 'a completed batch missing the matching identity',
      metadata: { status: 'completed', entries: [] }
    }
  ])('keeps missing models unknown for $label', ({ metadata }) => {
    const missing = model('incomplete.safetensors')
    const isDownloadable = vi.fn(() => true)

    const result = deriveTemplateModelSetup(
      [requirement(missing)],
      [{ model: missing, status: 'missing' }],
      metadata,
      { isDownloadable }
    )

    expect(result.rows).toEqual([
      {
        model: missing,
        usedBy: [],
        fileSize: null,
        modelType: { kind: 'known', key: 'checkpoint' },
        status: 'unknown'
      }
    ])
    expect(isDownloadable).not.toHaveBeenCalled()
    expect(result.rowTotal).toEqual({ bytes: 0, isComplete: false })
  })

  it('deduplicates totals by exact identity while preserving every row', () => {
    const installed = model('installed.safetensors')
    const checkpoint = model('shared-name.safetensors', 'checkpoints')
    const duplicateCheckpoint = { ...checkpoint }
    const lora = model('shared-name.safetensors', 'loras')
    const unknownSize = model('unknown-size.safetensors')
    const zeroBytes = model('empty.safetensors')
    const manual = model('manual.safetensors')
    const unavailable = model('unsupported.safetensors')
    const requirements = [
      requirement(installed, ['Installed Loader']),
      requirement(checkpoint, ['Checkpoint Loader']),
      requirement(duplicateCheckpoint, ['Second Checkpoint Loader']),
      requirement(lora, ['Lora Loader']),
      requirement(unknownSize),
      requirement(zeroBytes),
      requirement(manual),
      requirement(unavailable)
    ]
    const availability: ResolvedTemplateModelAvailability[] = [
      { model: installed, status: 'installed' },
      { model: checkpoint, status: 'missing' },
      { model: lora, status: 'missing' },
      { model: unknownSize, status: 'missing' },
      { model: zeroBytes, status: 'missing' },
      { model: manual, status: 'missing' },
      { model: unavailable, status: 'missing' }
    ]
    const metadata: TemplateModelMetadataBatchResult = {
      status: 'completed',
      entries: [
        resolvedMetadata(installed, 100),
        resolvedMetadata(checkpoint, 200),
        resolvedMetadata(lora, 300),
        resolvedMetadata(unknownSize, null),
        resolvedMetadata(zeroBytes, 0),
        resolvedMetadata(
          manual,
          50,
          'https://metadata-resolver.example/manual'
        ),
        resolvedMetadata(unavailable, 70)
      ]
    }
    const downloadableUrls = new Set([
      checkpoint.url,
      lora.url,
      unknownSize.url,
      zeroBytes.url
    ])

    const result = deriveTemplateModelSetup(
      requirements,
      availability,
      metadata,
      { isDownloadable: (candidate) => downloadableUrls.has(candidate.url) }
    )

    expect(result.rows.map((row) => row.usedBy)).toEqual(
      requirements.map((detail) => detail.usedBy)
    )
    expect(result.rows[0]).toMatchObject({
      status: 'installed',
      fileSize: 100
    })
    expect(result.rows).toHaveLength(requirements.length)
    expect(result.rowTotal).toEqual({ bytes: 720, isComplete: false })
  })

  it('treats a known zero-byte downloadable model as complete', () => {
    const empty = model('empty.safetensors')

    const result = deriveTemplateModelSetup(
      [requirement(empty)],
      [{ model: empty, status: 'missing' }],
      {
        status: 'completed',
        entries: [resolvedMetadata(empty, 0)]
      },
      { isDownloadable: () => true }
    )

    expect(result.rows[0]).toMatchObject({
      status: 'downloadable',
      fileSize: 0
    })
    expect(result.rowTotal).toEqual({ bytes: 0, isComplete: true })
  })

  it('derives known model types and preserves a raw directory fallback', () => {
    const models = [
      model('checkpoint.safetensors', 'checkpoints'),
      model('diffusion.safetensors', 'diffusion_models'),
      model('encoder.safetensors', 'text_encoders'),
      model('vae.safetensors', 'vae'),
      model('lora.safetensors', 'loras'),
      model('custom.safetensors', ' Custom_API_models '),
      model('untyped.safetensors', '')
    ]

    const result = deriveTemplateModelSetup(
      models.map((model) => requirement(model)),
      models.map((model) => ({ model, status: 'installed' })),
      { status: 'aborted' },
      { isDownloadable: () => false }
    )

    expect(result.rows.map((row) => row.modelType)).toEqual([
      { kind: 'known', key: 'checkpoint' },
      { kind: 'known', key: 'diffusionModel' },
      { kind: 'known', key: 'textEncoder' },
      { kind: 'known', key: 'vae' },
      { kind: 'known', key: 'lora' },
      { kind: 'directory', raw: 'Custom_API_models' },
      { kind: 'known', key: 'model' }
    ])
  })
})
