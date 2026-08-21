import { describe, expect, it } from 'vitest'

import { createPackInstallPayload } from './packInstallPayload'

describe('createPackInstallPayload', () => {
  it('uses the latest published version with current Manager defaults', () => {
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

  it('uses nightly for an unclaimed pack', () => {
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

  it('falls back to latest for a claimed pack without a published version', () => {
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

  it('throws the injected message when the pack ID is missing', () => {
    const nodeIdRequiredMessage = 'Localized node ID requirement'

    expect(() => createPackInstallPayload({}, nodeIdRequiredMessage)).toThrow(
      nodeIdRequiredMessage
    )
  })
})
