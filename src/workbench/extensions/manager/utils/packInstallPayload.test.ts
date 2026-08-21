import { describe, expect, it } from 'vitest'

import type { components } from '@/types/comfyRegistryTypes'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'

type NodePack = components['schemas']['Node']
type InstallPackParams = ManagerComponents['schemas']['InstallPackParams']
type CreatePackInstallPayload = (
  installItem: NodePack,
  nodeIdRequiredMessage: string
) => InstallPackParams

function isPayloadModule(
  value: unknown
): value is { createPackInstallPayload: CreatePackInstallPayload } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'createPackInstallPayload' in value &&
    typeof value.createPackInstallPayload === 'function'
  )
}

async function loadCreatePackInstallPayload() {
  const modulePath = './packInstallPayload'
  const value: unknown = await import(modulePath)

  if (!isPayloadModule(value)) {
    throw new Error('Expected createPackInstallPayload to be exported')
  }

  return value.createPackInstallPayload
}

describe('createPackInstallPayload', () => {
  it('uses the latest published version with current Manager defaults', async () => {
    const createPackInstallPayload = await loadCreatePackInstallPayload()

    expect(
      createPackInstallPayload(
        {
          id: 'comfyui-published-pack',
          repository: 'https://example.com/published-pack.git',
          publisher: { name: 'Comfy Publisher' },
          latest_version: { version: '1.2.3' }
        },
        'Node ID is required'
      )
    ).toEqual({
      id: 'comfyui-published-pack',
      repository: 'https://example.com/published-pack.git',
      channel: 'dev',
      mode: 'cache',
      selected_version: '1.2.3',
      version: '1.2.3'
    })
  })

  it('uses nightly for an unclaimed pack', async () => {
    const createPackInstallPayload = await loadCreatePackInstallPayload()

    expect(
      createPackInstallPayload(
        {
          id: 'comfyui-unclaimed-pack',
          repository: 'https://example.com/unclaimed-pack.git',
          publisher: { name: 'Unclaimed' },
          latest_version: { version: '9.9.9' }
        },
        'Node ID is required'
      )
    ).toMatchObject({
      id: 'comfyui-unclaimed-pack',
      repository: 'https://example.com/unclaimed-pack.git',
      selected_version: 'nightly',
      version: 'nightly'
    })
  })

  it('falls back to latest for a claimed pack without a published version', async () => {
    const createPackInstallPayload = await loadCreatePackInstallPayload()

    expect(
      createPackInstallPayload(
        { id: 'comfyui-minimal-pack', publisher: { name: 'Publisher' } },
        'Node ID is required'
      )
    ).toMatchObject({
      id: 'comfyui-minimal-pack',
      repository: '',
      selected_version: 'latest',
      version: 'latest'
    })
  })

  it('throws the injected message when the pack ID is missing', async () => {
    const createPackInstallPayload = await loadCreatePackInstallPayload()
    const nodeIdRequiredMessage = 'Localized node ID requirement'

    expect(() => createPackInstallPayload({}, nodeIdRequiredMessage)).toThrow(
      nodeIdRequiredMessage
    )
  })
})
