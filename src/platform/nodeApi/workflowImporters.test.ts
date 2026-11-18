import { reportError } from '@comfyorg/telemetry/reportError'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { ComfyApiError } from './errors'
import { createWorkflowApi } from './workflowHandle'
import { importWorkflowFile } from './workflowImporters'
import type { WorkflowImporter } from './workflowImporters'

const workflow = createWorkflowApi(() => undefined)

function register(importer: WorkflowImporter) {
  const stop = workflow.registerImporter(importer)
  onTestFinished(stop)
  return stop
}

const jpeg = (name = 'saved.jpg', bytes = [1, 2, 3]) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' })

describe('workflow importers', () => {
  it('hands a matching file to the importer and returns what it reads', async () => {
    const parse = vi.fn(() => ({ workflow: { nodes: [] } }))
    register({
      id: 'Pack.jpeg',
      mimeTypes: ['image/jpeg'],
      maxBytes: 1024,
      parse
    })

    await expect(importWorkflowFile(jpeg())).resolves.toEqual({
      workflow: { nodes: [] }
    })
    expect(parse).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), {
      name: 'saved.jpg',
      type: 'image/jpeg'
    })
  })

  it('asks importers in registration order until one reads the file', async () => {
    const order: string[] = []
    register({
      id: 'Pack.declines',
      maxBytes: 1024,
      parse: () => {
        order.push('declines')
        return null
      }
    })
    register({
      id: 'Pack.reads',
      maxBytes: 1024,
      parse: () => {
        order.push('reads')
        return { prompt: '{"1":{}}' }
      }
    })
    register({
      id: 'Pack.never',
      maxBytes: 1024,
      parse: () => {
        order.push('never')
        return { workflow: {} }
      }
    })

    await expect(importWorkflowFile(jpeg())).resolves.toEqual({
      prompt: '{"1":{}}'
    })
    expect(order).toEqual(['declines', 'reads'])
  })

  it.for([
    {
      name: 'another type and extension',
      importer: {
        mimeTypes: ['text/plain'],
        extensions: ['txt'],
        maxBytes: 1024
      }
    },
    { name: 'a file over its own limit', importer: { maxBytes: 2 } },
    {
      name: 'an importer that is switched off',
      importer: { maxBytes: 1024, enabled: () => false }
    },
    {
      name: 'an importer that is switched off asynchronously',
      importer: { maxBytes: 1024, enabled: async () => false }
    }
  ])('does not offer the file for $name', async ({ importer }) => {
    const parse = vi.fn(() => ({ workflow: {} }))
    const control = vi.fn(() => ({ workflow: { control: true } }))
    register({ id: 'Pack.skipped', ...importer, parse })
    register({ id: 'Pack.control', maxBytes: 1024, parse: control })

    await expect(importWorkflowFile(jpeg())).resolves.toEqual({
      workflow: { control: true }
    })
    expect(parse).not.toHaveBeenCalled()
  })

  it('never offers a file over the host limit', async () => {
    const parse = vi.fn(() => ({ workflow: {} }))
    register({ id: 'Pack.greedy', maxBytes: Number.MAX_SAFE_INTEGER, parse })
    const atLimit = new File([new Uint8Array(16 * 1024 * 1024)], 'at.jpg')
    const over = new File([new Uint8Array(16 * 1024 * 1024 + 1)], 'over.jpg')

    await expect(importWorkflowFile(over)).resolves.toBeUndefined()
    expect(parse).not.toHaveBeenCalled()
    await expect(importWorkflowFile(atLimit)).resolves.toEqual({ workflow: {} })
  })

  it('matches an extension whatever its case or leading dot', async () => {
    register({
      id: 'Pack.ext',
      extensions: ['.JPG'],
      maxBytes: 1024,
      parse: () => ({ workflow: {} })
    })
    const untyped = new File([new Uint8Array([1])], 'Photo.jpg')

    await expect(importWorkflowFile(untyped)).resolves.toEqual({ workflow: {} })
  })

  it('reports an importer that throws and still asks the next one', async () => {
    const broken = new Error('bad exif')
    register({
      id: 'Pack.broken',
      maxBytes: 1024,
      parse: () => {
        throw broken
      }
    })
    register({
      id: 'Pack.next',
      maxBytes: 1024,
      parse: () => ({ workflow: {} })
    })

    await expect(importWorkflowFile(jpeg())).resolves.toEqual({ workflow: {} })
    expect(reportError).toHaveBeenCalledWith(
      broken,
      expect.objectContaining({
        errorType: 'node_api_workflow_importer_failure',
        tags: { importer: 'Pack.broken' }
      })
    )
  })

  it('gives each importer its own copy of the bytes', async () => {
    register({
      id: 'Pack.scribbles',
      maxBytes: 1024,
      parse: (bytes) => {
        bytes.fill(0)
        return null
      }
    })
    const seen = vi.fn((bytes: Uint8Array) => ({
      workflow: { first: bytes[0] }
    }))
    register({ id: 'Pack.reads', maxBytes: 1024, parse: seen })

    await expect(importWorkflowFile(jpeg())).resolves.toEqual({
      workflow: { first: 1 }
    })
  })

  it('ignores a result that is neither a workflow nor a prompt', async () => {
    register({
      id: 'Pack.junk',
      maxBytes: 1024,
      parse: () => ({ workflow: null }) as never
    })

    await expect(importWorkflowFile(jpeg())).resolves.toBeUndefined()
  })

  it('stops asking an importer once it is unregistered, and only that one', async () => {
    const importer: WorkflowImporter = {
      id: 'Pack.twice',
      maxBytes: 1024,
      parse: () => ({ workflow: {} })
    }
    const stopFirst = register(importer)
    register(importer)

    stopFirst()
    stopFirst()

    await expect(importWorkflowFile(jpeg())).resolves.toEqual({ workflow: {} })
  })

  it.for([
    { name: 'no id', importer: { id: '', maxBytes: 1, parse: () => null } },
    {
      name: 'no size limit',
      importer: { id: 'Pack.x', maxBytes: 0, parse: () => null }
    },
    { name: 'no parser', importer: { id: 'Pack.x', maxBytes: 1 } }
  ])('refuses an importer with $name', ({ importer }) => {
    expect(() =>
      Reflect.apply(workflow.registerImporter, workflow, [importer])
    ).toThrow(ComfyApiError)
  })
})
