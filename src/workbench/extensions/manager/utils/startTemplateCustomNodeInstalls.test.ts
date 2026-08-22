import { describe, expect, it, vi } from 'vitest'

import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'

type InstallPackParams = ManagerComponents['schemas']['InstallPackParams']
import type { TemplateCustomNodeInstallDependencies as Dependencies } from './startTemplateCustomNodeInstalls'
import { startTemplateCustomNodeInstalls } from './startTemplateCustomNodeInstalls'

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
  it('hands off only unique proven-missing packages', () => {
    const missing = {
      id: 'missing-id',
      status: 'missing' as const,
      pack: { id: 'missing-id', latest_version: { version: '1.0.0' } }
    }
    const dependencies = createDependencies()

    expect(
      startTemplateCustomNodeInstalls(
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

  it('returns without waiting for admitted Manager work', () => {
    const installPack = vi.fn(() => new Promise<unknown>(() => undefined))

    expect(
      startTemplateCustomNodeInstalls(
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
    const error = new Error('queue unavailable')
    const dependencies = createDependencies({
      installPack: vi.fn().mockRejectedValue(error)
    })

    startTemplateCustomNodeInstalls(
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

  it('isolates a malformed package without blocking other handoffs', () => {
    const error = new Error('invalid payload')
    const dependencies = createDependencies({
      createPayload: vi.fn((pack) => {
        if (pack.id === 'bad-id') throw error
        return { ...payload, id: pack.id ?? '' }
      })
    })

    expect(
      startTemplateCustomNodeInstalls(
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
