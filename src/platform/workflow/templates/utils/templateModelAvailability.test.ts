import { describe, expect, it } from 'vitest'

import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'

const modulePath = './templateModelAvailability'

type ModelAvailabilityStatus = 'installed' | 'missing' | 'unknown'

type ModelAvailability = {
  model: ModelFile
  status: ModelAvailabilityStatus
}

type ModelInventory = {
  isComplete: boolean
  models: readonly { directory: string; name: string }[]
}

type ModelAvailabilityModule = {
  resolveTemplateModelAvailability: (
    models: readonly ModelFile[],
    inventory: ModelInventory
  ) => readonly ModelAvailability[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isModelAvailabilityModule(
  value: unknown
): value is ModelAvailabilityModule {
  return (
    isRecord(value) &&
    typeof value.resolveTemplateModelAvailability === 'function'
  )
}

async function resolveTemplateModelAvailability(
  models: readonly ModelFile[],
  inventory: ModelInventory
): Promise<readonly ModelAvailability[]> {
  try {
    const module: unknown = await import(modulePath)
    if (!isModelAvailabilityModule(module)) return []

    return module.resolveTemplateModelAvailability(models, inventory)
  } catch {
    return []
  }
}

function model(name: string, directory: string): ModelFile {
  return {
    name,
    directory,
    url: `https://example.com/${name.replaceAll('\\', '/')}`
  }
}

describe('resolveTemplateModelAvailability', () => {
  it('matches an installed model by normalized filename and exact directory', async () => {
    const required = model('nested\\model.safetensors', 'checkpoints')

    await expect(
      resolveTemplateModelAvailability([required], {
        isComplete: false,
        models: [
          { directory: 'checkpoints', name: 'nested/model.safetensors' },
          { directory: 'loras', name: 'nested/model.safetensors' }
        ]
      })
    ).resolves.toEqual([{ model: required, status: 'installed' }])
  })

  it('classifies an absent model as missing only in a complete inventory', async () => {
    const required = model('model.safetensors', 'checkpoints')

    await expect(
      resolveTemplateModelAvailability([required], {
        isComplete: true,
        models: [{ directory: 'loras', name: required.name }]
      })
    ).resolves.toEqual([{ model: required, status: 'missing' }])
  })

  it('keeps absence unknown while the inventory is incomplete', async () => {
    const installed = model('installed.safetensors', 'checkpoints')
    const unresolved = model('unresolved.safetensors', 'checkpoints')

    await expect(
      resolveTemplateModelAvailability([installed, unresolved], {
        isComplete: false,
        models: [{ directory: installed.directory, name: installed.name }]
      })
    ).resolves.toEqual([
      { model: installed, status: 'installed' },
      { model: unresolved, status: 'unknown' }
    ])
  })
})
