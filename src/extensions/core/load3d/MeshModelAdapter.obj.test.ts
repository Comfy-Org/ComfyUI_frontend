import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OBJLoader2Parallel } from 'wwobjloader2'

import { MeshModelAdapter } from './MeshModelAdapter'
import type { ModelLoadContext } from './ModelAdapter'

interface WorkerRequest {
  cmd: string
  uuid: string
}

type PostMessage = (message: WorkerRequest) => 'drop' | void

const OBJ_BYTES = new TextEncoder().encode(
  'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'
)

let workers: FakeWorker[] = []
let onPostMessage: PostMessage | null = null

class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null
  readonly terminate = vi.fn()
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>()

  constructor() {
    workers.push(this)
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.get(type)?.delete(listener)
  }

  emitError(error: Error) {
    const event = { error, message: error.message }
    this.listeners.get('error')?.forEach((listener) => listener(event))
  }

  postMessage(message: WorkerRequest, transfer: Transferable[] = []) {
    if (onPostMessage?.(message) === 'drop') return
    // Real structured clone: detaches transferred buffers and throws
    // DataCloneError when a buffer was already transferred.
    structuredClone(message, { transfer })
    const response = message.cmd === 'init' ? 'initComplete' : 'executeComplete'
    queueMicrotask(() =>
      this.onmessage?.({
        data: { cmd: response, uuid: message.uuid, payloads: [] }
      })
    )
  }
}

function makeContext(): ModelLoadContext {
  return {
    setOriginalModel: vi.fn(),
    registerOriginalMaterial: vi.fn(),
    standardMaterial: new THREE.MeshStandardMaterial(),
    materialMode: 'wireframe'
  }
}

describe('MeshModelAdapter OBJ worker loading', () => {
  beforeEach(() => {
    workers = []
    onPostMessage = null
    // wwobjloader2 is loaded untransformed in vitest, so its Vite-only
    // import.meta.env.DEV default-URL lookup has to be bypassed.
    vi.spyOn(OBJLoader2Parallel, 'getModuleWorkerDefaultUrl').mockReturnValue(
      new URL('file:///worker.js')
    )
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(OBJ_BYTES.slice())))
    )
  })

  const path = 'http://localhost/api/view/'

  it('loads two overlapping requests for the same OBJ', async () => {
    const adapter = new MeshModelAdapter()

    const [first, second] = await Promise.all([
      adapter.load(makeContext(), path, 'cube.obj'),
      adapter.load(makeContext(), path, 'cube.obj')
    ])

    expect(first!.object).toBeInstanceOf(THREE.Object3D)
    expect(second!.object).toBeInstanceOf(THREE.Object3D)
    expect(second!.object).not.toBe(first!.object)
  }, 2000)

  it('rejects instead of hanging when the worker refuses the OBJ data', async () => {
    onPostMessage = (message) => {
      if (message.cmd === 'execute') {
        throw new DOMException('ArrayBuffer is detached', 'DataCloneError')
      }
    }
    const adapter = new MeshModelAdapter()

    await expect(
      adapter.load(makeContext(), path, 'cube.obj')
    ).rejects.toMatchObject({ name: 'DataCloneError' })
    expect(workers.every((w) => w.terminate.mock.calls.length > 0)).toBe(true)
  }, 2000)

  it('rejects instead of hanging when the worker script fails', async () => {
    onPostMessage = (message) => {
      if (message.cmd !== 'execute') return
      queueMicrotask(() => workers[0].emitError(new Error('worker crashed')))
      return 'drop'
    }
    const adapter = new MeshModelAdapter()

    await expect(adapter.load(makeContext(), path, 'cube.obj')).rejects.toThrow(
      'worker crashed'
    )
  }, 2000)

  it('terminates the worker once the OBJ is parsed', async () => {
    const adapter = new MeshModelAdapter()

    await adapter.load(makeContext(), path, 'cube.obj')
    await adapter.load(makeContext(), path, 'cube.obj')

    expect(workers).toHaveLength(2)
    expect(workers.every((w) => w.terminate.mock.calls.length === 1)).toBe(true)
  })
})
