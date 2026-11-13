import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, describe, expect, it, vi } from 'vitest'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type {
  WorkflowImportContext,
  WorkflowImporter
} from '@/platform/nodeApi/v4/types'

function api() {
  return createComfyApi({ getGraph: () => null })
}

function file(name: string, type = '', content = 'bytes') {
  return new File([content], name, { type })
}

function importer(overrides: Partial<WorkflowImporter> = {}): WorkflowImporter {
  return {
    id: 'pack.importer',
    maxBytes: 1024,
    parse: () => ({ workflow: { version: 0.4 } }),
    ...overrides
  }
}

describe('workflow.registerImporter', () => {
  it('asks an importer for a file the host found no workflow in', async () => {
    const { comfy, host } = api()
    const parse = vi.fn(
      (_bytes: Uint8Array, _context: WorkflowImportContext) => ({
        workflow: { version: 0.4 }
      })
    )
    comfy.workflow.registerImporter(importer({ parse }))

    const imported = await host.importWorkflowFile(file('a.bin'), undefined)

    expect(imported).toEqual({ workflow: { version: 0.4 } })
    expect(parse).toHaveBeenCalledExactlyOnceWith(
      new Uint8Array(new TextEncoder().encode('bytes')),
      { name: 'a.bin', type: '' }
    )
    expect(Object.isFrozen(parse.mock.calls[0][1])).toBe(true)
  })

  it.for([
    ['workflow', { workflow: '{}' }],
    ['prompt', { prompt: {} }],
    ['parameters', { parameters: 'Steps: 20' }],
    ['templates', { templates: '[]' }]
  ] as const)(
    'leaves a file alone when the host found a %s in it',
    async ([, found]) => {
      const { comfy, host } = api()
      const parse = vi.fn()
      comfy.workflow.registerImporter(importer({ parse }))

      await expect(host.importWorkflowFile(file('a.png'), found)).resolves.toBe(
        found
      )
      expect(parse).not.toHaveBeenCalled()
    }
  )

  it('asks an importer when the host found only empty fields', async () => {
    const { comfy, host } = api()
    comfy.workflow.registerImporter(
      importer({ parse: () => ({ prompt: '{}' }) })
    )

    await expect(
      host.importWorkflowFile(file('a.webp'), {
        workflow: undefined,
        prompt: undefined
      })
    ).resolves.toEqual({ prompt: '{}' })
  })

  it('reads the file once however many importers it is offered to', async () => {
    const { comfy, host } = api()
    comfy.workflow.registerImporter(
      importer({ id: 'first', parse: () => null })
    )
    comfy.workflow.registerImporter(
      importer({ id: 'second', parse: () => null })
    )
    const unread = file('a.bin')
    const read = vi.spyOn(unread, 'arrayBuffer')

    await host.importWorkflowFile(unread, undefined)

    expect(read).toHaveBeenCalledOnce()
  })

  it('offers a file exactly as large as the importer takes', async () => {
    const { comfy, host } = api()
    const parse = vi.fn()
    comfy.workflow.registerImporter(importer({ maxBytes: 5, parse }))

    await host.importWorkflowFile(file('a.bin', '', 'five!'), undefined)

    expect(parse).toHaveBeenCalledOnce()
  })

  it('does not take a whole file name without a dot for an extension', async () => {
    const { comfy, host } = api()
    const parse = vi.fn()
    comfy.workflow.registerImporter(importer({ extensions: ['bin'], parse }))

    await host.importWorkflowFile(file('bin'), undefined)

    expect(parse).not.toHaveBeenCalled()
  })

  it('declines a result that is not an object without reporting an error', async () => {
    const { comfy, host } = api()
    comfy.workflow.registerImporter(importer({ parse: () => null }))

    await expect(
      host.importWorkflowFile(file('a.bin'), undefined)
    ).resolves.toBeUndefined()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('keeps what the host found when no importer reads the file', async () => {
    const { comfy, host } = api()
    const found = {}
    comfy.workflow.registerImporter(importer({ parse: () => null }))

    await expect(host.importWorkflowFile(file('a.bin'), found)).resolves.toBe(
      found
    )
  })

  it('offers a file by extension, in any case and with or without a dot, or by type', async () => {
    const { comfy, host } = api()
    const byExtension = vi.fn()
    const byType = vi.fn()
    comfy.workflow.registerImporter(
      importer({ id: 'ext', extensions: ['.EXR', 'tiff'], parse: byExtension })
    )
    comfy.workflow.registerImporter(
      importer({ id: 'type', mimeTypes: ['image/x-exr'], parse: byType })
    )

    await host.importWorkflowFile(file('render.exr'), undefined)
    await host.importWorkflowFile(file('scan.TIFF'), undefined)
    await host.importWorkflowFile(file('plain', 'image/x-exr'), undefined)
    await host.importWorkflowFile(file('other.png', 'image/png'), undefined)

    expect(byExtension).toHaveBeenCalledTimes(2)
    expect(byType).toHaveBeenCalledOnce()
  })

  it('does not offer a file larger than the importer takes, nor read it', async () => {
    const { comfy, host } = api()
    const parse = vi.fn()
    comfy.workflow.registerImporter(importer({ maxBytes: 4, parse }))
    const large = file('a.bin', '', 'five!')
    const read = vi.spyOn(large, 'arrayBuffer')

    await host.importWorkflowFile(large, undefined)

    expect(parse).not.toHaveBeenCalled()
    expect(read).not.toHaveBeenCalled()
  })

  it('skips a disabled importer, whether it answers at once or later', async () => {
    const { comfy, host } = api()
    const disabled = vi.fn()
    const later = vi.fn()
    const enabled = vi.fn(() => ({ prompt: '{}' }))
    comfy.workflow.registerImporter(
      importer({ id: 'off', enabled: () => false, parse: disabled })
    )
    comfy.workflow.registerImporter(
      importer({ id: 'later', enabled: async () => false, parse: later })
    )
    comfy.workflow.registerImporter(
      importer({ id: 'on', enabled: async () => true, parse: enabled })
    )

    await expect(
      host.importWorkflowFile(file('a.bin'), undefined)
    ).resolves.toEqual({ prompt: '{}' })
    expect(disabled).not.toHaveBeenCalled()
    expect(later).not.toHaveBeenCalled()
  })

  it('reports an importer that throws and asks the next, which gets its own copy of the bytes', async () => {
    const { comfy, host } = api()
    const broken = new Error('pack failed')
    comfy.workflow.registerImporter(
      importer({
        id: 'broken',
        parse: (bytes) => {
          bytes.fill(0)
          throw broken
        }
      })
    )
    const next = vi.fn(() => ({ workflow: '{}' }))
    comfy.workflow.registerImporter(importer({ id: 'next', parse: next }))

    await expect(
      host.importWorkflowFile(file('a.bin'), undefined)
    ).resolves.toEqual({ workflow: '{}' })
    expect(next.mock.calls[0]).toEqual([
      new Uint8Array(new TextEncoder().encode('bytes')),
      expect.anything()
    ])
    expect(reportError).toHaveBeenCalledExactlyOnceWith(broken, {
      errorType: 'node_api_workflow_importer_failure',
      surface: 'platform',
      tags: { importer: 'broken' }
    })
  })

  it('reports an enabled check that throws, and asks the next importer', async () => {
    const { comfy, host } = api()
    comfy.workflow.registerImporter(
      importer({
        id: 'broken',
        enabled: () => {
          throw new Error('pack failed')
        }
      })
    )
    comfy.workflow.registerImporter(
      importer({ id: 'next', parse: () => ({ prompt: '{}' }) })
    )

    await expect(
      host.importWorkflowFile(file('a.bin'), undefined)
    ).resolves.toEqual({ prompt: '{}' })
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('copies a workflow object the importer returns, and declines anything else', async () => {
    const { comfy, host } = api()
    const returned = { version: 0.4 }
    const results: unknown[] = [
      [],
      { workflow: 1 },
      { prompt: [] },
      { workflow: returned }
    ]
    Reflect.apply(comfy.workflow.registerImporter, comfy.workflow, [
      { ...importer(), parse: () => results.shift() }
    ])

    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(
        host.importWorkflowFile(file('a.bin'), undefined)
      ).resolves.toBeUndefined()
    }
    const imported = await host.importWorkflowFile(file('a.bin'), undefined)

    expect(imported).toEqual({ workflow: { version: 0.4 } })
    assert(imported && 'workflow' in imported)
    expect(imported.workflow).not.toBe(returned)
  })

  it('stops asking an importer once its registration is disposed', async () => {
    const { comfy, host } = api()
    const parse = vi.fn()
    const stop = comfy.workflow.registerImporter(importer({ parse }))

    stop()
    stop()
    await host.importWorkflowFile(file('a.bin'), undefined)

    expect(parse).not.toHaveBeenCalled()
    expect(() => comfy.workflow.registerImporter(importer())).not.toThrow()
  })

  it.for([
    ['a non-object', 'importer'],
    ['a missing id', { ...importer(), id: undefined }],
    ['an empty id', { ...importer(), id: '' }],
    ['a parse that is not a function', { ...importer(), parse: 'parse' }],
    ['an enabled that is not a function', { ...importer(), enabled: true }],
    ['a zero maxBytes', { ...importer(), maxBytes: 0 }],
    ['a non-finite maxBytes', { ...importer(), maxBytes: Infinity }],
    ['a maxBytes that is not a number', { ...importer(), maxBytes: '1024' }],
    ['mimeTypes as one string', { ...importer(), mimeTypes: 'image/png' }],
    ['extensions with an empty name', { ...importer(), extensions: [''] }],
    ['extensions with a number', { ...importer(), extensions: [1] }]
  ] as const)('refuses %s and registers nothing', async ([, invalid]) => {
    const { comfy, host } = api()

    expect(() =>
      Reflect.apply(comfy.workflow.registerImporter, comfy.workflow, [invalid])
    ).toThrow(/^workflow\.registerImporter needs /)
    await expect(
      host.importWorkflowFile(file('a.bin'), undefined)
    ).resolves.toBeUndefined()
  })

  it('refuses a second importer with an id already taken', () => {
    const { comfy } = api()
    comfy.workflow.registerImporter(importer())

    expect(() => comfy.workflow.registerImporter(importer())).toThrow(
      "workflow.registerImporter needs an id no other importer has, not 'pack.importer'."
    )
  })
})
