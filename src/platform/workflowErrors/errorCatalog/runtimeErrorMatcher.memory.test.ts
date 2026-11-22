import { describe, expect, it } from 'vitest'

import { resolveRuntimeCatalogMatch } from './runtimeErrorMatcher'

const CLOUD_HOST_RAM_KILLS = [
  {
    name: 'a container OOM kill (inference container_exit.go)',
    exceptionType: 'OOMError',
    exceptionMessage:
      'This workflow ran out of memory on the server. Try a shorter video, lower resolution or smaller batch.'
  },
  {
    name: 'a sidecar OOM kill (inference comfy/manager.go)',
    exceptionType: 'OOMError',
    exceptionMessage:
      'Workflow execution failed due to insufficient memory (OOM). Try reducing image resolution or batch size.'
  },
  {
    name: 'an OOMError naming no device',
    exceptionType: 'OOMError',
    exceptionMessage: 'OOMError: Workflow execution failed'
  }
]

const GPU_VRAM_EXHAUSTIONS = [
  {
    name: "core's allocation tip",
    exceptionType: 'Exception',
    exceptionMessage:
      'Allocation on device \nThis error means you ran out of memory on your GPU.'
  },
  {
    name: "torch's CUDA OOM",
    exceptionType: 'OutOfMemoryError',
    exceptionMessage:
      'torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 2.00 GiB'
  },
  {
    name: "torch.cuda's exception name",
    exceptionType: 'OutOfMemoryError',
    exceptionMessage: 'torch.cuda.OutOfMemoryError: Allocation failed'
  },
  {
    name: 'a CUDA driver OOM',
    exceptionType: 'RuntimeError',
    exceptionMessage: 'CUDA error: out of memory'
  },
  {
    name: "comfy-aimdo's VRAM grow failure",
    exceptionType: 'Exception',
    exceptionMessage: 'VRAM grow failed'
  },
  {
    name: 'an OOMError whose message still names the GPU',
    exceptionType: 'OOMError',
    exceptionMessage:
      'Allocation on device \nThis error means you ran out of memory on your GPU.'
  }
]

const DEVICELESS_EXHAUSTIONS = [
  {
    name: 'a bare runtime OOM',
    exceptionMessage: 'RuntimeError: out of memory'
  },
  { name: 'a bare OutOfMemoryError text', exceptionMessage: 'OutOfMemoryError' }
]

describe('resolveRuntimeCatalogMatch memory exhaustion', () => {
  it.for(CLOUD_HOST_RAM_KILLS)(
    'reads $name as the server running out of memory',
    (info) => {
      expect(resolveRuntimeCatalogMatch(info)?.catalogId).toBe(
        'server_out_of_memory'
      )
    }
  )

  it.for(GPU_VRAM_EXHAUSTIONS)('reads $name as GPU memory', (info) => {
    expect(resolveRuntimeCatalogMatch(info)?.catalogId).toBe('out_of_memory')
  })

  it.for(DEVICELESS_EXHAUSTIONS)(
    'leaves $name uncataloged rather than guessing a device',
    ({ exceptionMessage }) => {
      expect(
        resolveRuntimeCatalogMatch({
          exceptionType: 'Exception',
          exceptionMessage
        })
      ).toBeUndefined()
    }
  )
})
