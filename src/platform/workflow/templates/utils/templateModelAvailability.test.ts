import { describe, expect, it } from 'vitest'

import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import { resolveTemplateModelAvailability } from './templateModelAvailability'

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

    expect(
      resolveTemplateModelAvailability([required], {
        isComplete: false,
        models: [
          { directory: 'checkpoints', name: 'nested/model.safetensors' },
          { directory: 'loras', name: 'nested/model.safetensors' }
        ]
      })
    ).toEqual([{ model: required, status: 'installed' }])
  })

  it('classifies an absent model as missing only in a complete inventory', async () => {
    const required = model('model.safetensors', 'checkpoints')

    expect(
      resolveTemplateModelAvailability([required], {
        isComplete: true,
        models: [{ directory: 'loras', name: required.name }]
      })
    ).toEqual([{ model: required, status: 'missing' }])
  })

  it('keeps absence unknown while the inventory is incomplete', async () => {
    const installed = model('installed.safetensors', 'checkpoints')
    const unresolved = model('unresolved.safetensors', 'checkpoints')

    expect(
      resolveTemplateModelAvailability([installed, unresolved], {
        isComplete: false,
        models: [{ directory: installed.directory, name: installed.name }]
      })
    ).toEqual([
      { model: installed, status: 'installed' },
      { model: unresolved, status: 'unknown' }
    ])
  })
})
