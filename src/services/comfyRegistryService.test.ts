import { describe, expect, it } from 'vitest'

import { useComfyRegistryService } from '@/services/comfyRegistryService'

/**
 * axios rejects with `CanceledError` before it dispatches a request whose signal
 * is already aborted, so these exercise the real cancellation path without
 * touching the network.
 */
describe('useComfyRegistryService cancellation', () => {
  const abortedSignal = () => {
    const controller = new AbortController()
    controller.abort()
    return controller.signal
  }

  it('does not set an error when getNodeDefs is cancelled', async () => {
    const service = useComfyRegistryService()

    const result = await service.getNodeDefs(
      { packId: 'some-pack', version: '1.0.0' },
      abortedSignal()
    )

    expect(result).toBeNull()
    expect(service.error.value).toBeNull()
  })

  it('does not set an error when inferPackFromNodeName is cancelled', async () => {
    const service = useComfyRegistryService()

    const result = await service.inferPackFromNodeName(
      'SomeNode',
      abortedSignal()
    )

    expect(result).toBeNull()
    expect(service.error.value).toBeNull()
  })
})
