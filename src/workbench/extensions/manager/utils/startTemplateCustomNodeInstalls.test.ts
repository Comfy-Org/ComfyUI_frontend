import { describe, expect, it, vi } from 'vitest'

import type { components } from '@/types/comfyRegistryTypes'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'

type NodePack = components['schemas']['Node']
type InstallPackParams = ManagerComponents['schemas']['InstallPackParams']
type Availability =
  | { id: string; status: 'installed' | 'disabled' | 'in-progress' | 'unknown' }
  | { id: string; status: 'unavailable'; reason: string }
  | { id: string; status: 'missing'; pack: NodePack }
type Dependencies = {
  createPayload: (pack: NodePack) => InstallPackParams
  installPack: (params: InstallPackParams) => Promise<unknown>
  clearInstallCache: () => void
  reportUnexpectedError: (error: unknown) => void
}
type StartInstalls = (
  availability: readonly Availability[],
  dependencies: Dependencies
) => string[]

function isInstallModule(
  value: unknown
): value is { startTemplateCustomNodeInstalls: StartInstalls } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'startTemplateCustomNodeInstalls' in value &&
    typeof value.startTemplateCustomNodeInstalls === 'function'
  )
}

async function loadStartInstalls(): Promise<StartInstalls> {
  const modulePath = './startTemplateCustomNodeInstalls'
  const value: unknown = await import(modulePath)
  if (!isInstallModule(value)) {
    throw new Error('Expected the custom-node install handoff')
  }
  return value.startTemplateCustomNodeInstalls
}

const payload: InstallPackParams = {
  id: 'missing-id',
  repository: 'https://example.com/missing.git',
  channel: 'dev',
  mode: 'cache',
  selected_version: '1.0.0',
  version: '1.0.0'
}

function createDependencies(
  overrides: Partial<Dependencies> = {}
): Dependencies {
  return {
    createPayload: vi.fn(() => payload),
    installPack: vi.fn().mockResolvedValue(undefined),
    clearInstallCache: vi.fn(),
    reportUnexpectedError: vi.fn(),
    ...overrides
  }
}

describe('startTemplateCustomNodeInstalls', () => {
  it('hands off only unique proven-missing packages', async () => {
    const startInstalls = await loadStartInstalls()
    const missing = {
      id: 'missing-id',
      status: 'missing' as const,
      pack: { id: 'missing-id', latest_version: { version: '1.0.0' } }
    }
    const dependencies = createDependencies()

    expect(
      startInstalls(
        [
          missing,
          missing,
          { id: 'installed-id', status: 'installed' },
          { id: 'disabled-id', status: 'disabled' },
          { id: 'progress-id', status: 'in-progress' },
          { id: 'unknown-id', status: 'unknown' },
          { id: 'unsafe-id', status: 'unavailable', reason: 'unsafe' }
        ],
        dependencies
      )
    ).toEqual(['missing-id'])
    expect(dependencies.createPayload).toHaveBeenCalledOnce()
    expect(dependencies.installPack).toHaveBeenCalledWith(payload)
  })

  it('returns without waiting for admitted Manager work', async () => {
    const startInstalls = await loadStartInstalls()
    const installPack = vi.fn(() => new Promise<unknown>(() => undefined))

    expect(
      startInstalls(
        [
          {
            id: 'missing-id',
            status: 'missing',
            pack: { id: 'missing-id' }
          }
        ],
        createDependencies({ installPack })
      )
    ).toEqual(['missing-id'])
    expect(installPack).toHaveBeenCalledOnce()
  })

  it('clears request cache after rejection so a row can retry', async () => {
    const startInstalls = await loadStartInstalls()
    const error = new Error('queue unavailable')
    const dependencies = createDependencies({
      installPack: vi.fn().mockRejectedValue(error)
    })

    startInstalls(
      [
        {
          id: 'missing-id',
          status: 'missing',
          pack: { id: 'missing-id' }
        }
      ],
      dependencies
    )
    await Promise.resolve()
    await Promise.resolve()

    expect(dependencies.clearInstallCache).toHaveBeenCalledOnce()
    expect(dependencies.reportUnexpectedError).toHaveBeenCalledWith(error)
  })

  it('isolates a malformed package without blocking other handoffs', async () => {
    const startInstalls = await loadStartInstalls()
    const error = new Error('invalid payload')
    const dependencies = createDependencies({
      createPayload: vi.fn((pack) => {
        if (pack.id === 'bad-id') throw error
        return { ...payload, id: pack.id ?? '' }
      })
    })

    expect(
      startInstalls(
        [
          { id: 'bad-id', status: 'missing', pack: { id: 'bad-id' } },
          { id: 'good-id', status: 'missing', pack: { id: 'good-id' } }
        ],
        dependencies
      )
    ).toEqual(['good-id'])
    expect(dependencies.installPack).toHaveBeenCalledOnce()
    expect(dependencies.reportUnexpectedError).toHaveBeenCalledWith(error)
  })
})
