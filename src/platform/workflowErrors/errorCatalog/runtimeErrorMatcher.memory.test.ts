import { describe, expect, it } from 'vitest'

import { resolveRuntimeCatalogMatch } from './runtimeErrorMatcher'

// Every message below is verbatim from the code that emits it, so a backend
// rewording shows up here as a failing test rather than as wrong advice in the
// run-error dialog. Host RAM and GPU VRAM need different advice and the two
// were conflated: a kill for host memory told the user to lower resolution to
// save VRAM (BE-27004).
//
// Cloud mints exception type OOMError at exactly two sites, both host memory:
//   services/inference/gateways/comfy/container_exit.go  containerOOMMessage
//   services/inference/gateways/comfy/manager.go          sidecar oom_detected
// ComfyUI core reports VRAM exhaustion as torch.cuda.OutOfMemoryError and never
// under that type name, so OOMError without GPU evidence is the server's RAM.

const CLOUD_HOST_RAM_KILLS = [
  // container_exit.go: the cgroup/kubelet OOM-killed the container.
  {
    name: 'container OOM kill',
    exceptionType: 'OOMError',
    exceptionMessage:
      'This workflow ran out of memory on the server. Try a shorter video, lower resolution or smaller batch.'
  },
  // manager.go: the sidecar saw the kernel SIGKILL the ComfyUI process.
  {
    name: 'sidecar OOM kill',
    exceptionType: 'OOMError',
    exceptionMessage:
      'Workflow execution failed due to insufficient memory (OOM). Try reducing image resolution or batch size.'
  },
  // The type alone, with a message that names no device.
  {
    name: 'OOMError naming no device',
    exceptionType: 'OOMError',
    exceptionMessage: 'OOMError: Workflow execution failed'
  }
]

const GPU_VRAM_EXHAUSTIONS = [
  {
    name: 'core allocation tip',
    exceptionType: 'Exception',
    exceptionMessage:
      'Allocation on device \nThis error means you ran out of memory on your GPU.'
  },
  {
    name: 'torch CUDA OOM',
    exceptionType: 'OutOfMemoryError',
    exceptionMessage:
      'torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 2.00 GiB'
  },
  {
    name: 'torch.cuda exception type',
    exceptionType: 'OutOfMemoryError',
    exceptionMessage: 'torch.cuda.OutOfMemoryError: Allocation failed'
  },
  {
    name: 'CUDA driver OOM',
    exceptionType: 'RuntimeError',
    exceptionMessage: 'CUDA error: out of memory'
  },
  {
    name: 'comfy-aimdo VRAM grow',
    exceptionType: 'Exception',
    exceptionMessage: 'VRAM grow failed'
  },
  // A cloud-reported kill that does name the GPU keeps the VRAM advice: the GPU
  // rule is matched before the host-RAM rule.
  {
    name: 'OOMError carrying GPU evidence',
    exceptionType: 'OOMError',
    exceptionMessage:
      'Allocation on device \nThis error means you ran out of memory on your GPU.'
  }
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

  // The catalog has no id for an exhaustion that names no device and carries no
  // cloud kill signal. Leaving it uncataloged shows the raw message instead of
  // naming a device the error never named.
  it.for([
    {
      name: 'bare runtime OOM',
      exceptionMessage: 'RuntimeError: out of memory'
    },
    { name: 'bare OutOfMemoryError text', exceptionMessage: 'OutOfMemoryError' }
  ])(
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
