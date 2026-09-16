import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ComfyNode,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'

import { prepareTemplateInputs } from './templateInputService'

const sourceRevision = '0123456789abcdef0123456789abcdef01234567'

function videoNode(id = 35, file = 'kitten_cop.mp4'): ComfyNode {
  return {
    id,
    type: 'LoadVideo',
    pos: [0, 0],
    size: [300, 200],
    flags: {},
    order: 0,
    mode: 0,
    properties: {},
    widgets_values: [file, 'image'],
    widgets_values_named: { file, upload: 'image' }
  }
}

function workflow(nodes = [videoNode()]): ComfyWorkflowJSON {
  return { version: 0.4, last_node_id: 35, last_link_id: 0, nodes, links: [] }
}

function input(file = 'kitten_cop.mp4') {
  return {
    nodeId: 35,
    nodeType: 'LoadVideo',
    file,
    mediaType: 'video',
    sourceRevision
  }
}

function prepare(
  graph = workflow(),
  inputs: unknown = [input()],
  signal = new AbortController().signal,
  restoreNamed = false
) {
  return prepareTemplateInputs(graph, inputs, signal, restoreNamed)
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('video bytes'))
  )
  vi.spyOn(api, 'fetchApi').mockResolvedValue(
    Response.json({
      name: 'kitten_cop.mp4',
      subfolder: '',
      type: 'input'
    })
  )
})

describe('template input preparation', () => {
  it.for([
    {
      nodeType: 'LoadImage',
      widget: 'image',
      file: 'input-aspect-ratio-converter',
      mediaType: 'image'
    },
    {
      nodeType: 'LoadAudio',
      widget: 'audio',
      file: 'sample.mp3',
      mediaType: 'audio'
    }
  ])(
    'prepares declared $mediaType samples through the same upload path',
    async ({ nodeType, widget, file, mediaType }) => {
      const node: ComfyNode = {
        ...videoNode(35, file),
        type: nodeType,
        widgets_values_named: { [widget]: file }
      }
      vi.mocked(api.fetchApi).mockResolvedValue(
        Response.json({ name: `saved-${file}` })
      )
      const result = await prepare(workflow([node]), [
        { nodeId: 35, nodeType, file, mediaType, sourceRevision }
      ])
      expect(result.workflow.nodes[0].widgets_values_named).toEqual({
        [widget]: `saved-${file}`
      })
    }
  )
  it('uploads the downloaded video and binds every matching node to the saved filename', async () => {
    const original = workflow([videoNode(), videoNode(36)])
    vi.spyOn(api, 'fetchApi').mockImplementation(async (route, options) => {
      expect(route).toBe('/upload/image')
      expect(options?.method).toBe('POST')
      const body = options?.body
      if (!(body instanceof FormData))
        throw new Error('Expected multipart upload')
      expect(body.get('type')).toBe('input')
      expect(body.has('overwrite')).toBe(false)
      const file = body.get('image')
      if (!(file instanceof File)) throw new Error('Expected a video file')
      expect(file.name).toBe('kitten_cop.mp4')
      expect(await file.text()).toBe('video bytes')
      return Response.json({
        name: 'kitten_cop (1).mp4',
        subfolder: '',
        type: 'input'
      })
    })

    const result = await prepare(original)

    for (const node of result.workflow.nodes) {
      expect(node.widgets_values).toEqual(['kitten_cop (1).mp4', 'image'])
      expect(node.widgets_values_named).toEqual({
        file: 'kitten_cop (1).mp4',
        upload: 'image'
      })
    }
    expect(original.nodes[0].widgets_values).toEqual([
      'kitten_cop.mp4',
      'image'
    ])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      `https://raw.githubusercontent.com/Comfy-Org/workflow_templates/${sourceRevision}/input/kitten_cop.mp4`,
      expect.any(Object)
    )
    expect(api.fetchApi).toHaveBeenCalledTimes(1)
  })

  it.for([false, true])(
    'preserves positional-only and legacy name-keyed widget serialization (named restoration: %s)',
    async (restoreNamed) => {
      const positional = videoNode()
      delete positional.widgets_values_named
      const keyed: ComfyNode = {
        ...videoNode(36),
        widgets_values: { file: 'kitten_cop.mp4' }
      }
      delete keyed.widgets_values_named
      vi.mocked(api.fetchApi).mockResolvedValue(
        Response.json({ name: 'saved.mp4', subfolder: 'examples' })
      )

      const result = await prepare(
        workflow([positional, keyed]),
        [input()],
        new AbortController().signal,
        restoreNamed
      )

      expect(result.workflow.nodes[0].widgets_values).toEqual([
        'examples/saved.mp4',
        'image'
      ])
      expect(result.workflow.nodes[0].widgets_values_named).toBeUndefined()
      expect(result.workflow.nodes[1].widgets_values).toEqual({
        file: 'examples/saved.mp4'
      })
    }
  )

  it.for([{}, { file: null }])(
    'does not fall back to positional media when the named value is missing: %j',
    async (named) => {
      const graph = workflow([{ ...videoNode(), widgets_values_named: named }])
      const result = await prepare(
        graph,
        [input()],
        new AbortController().signal,
        true
      )

      expect(result).toEqual({ workflow: graph, errors: [] })
      expect(fetch).not.toHaveBeenCalled()
      expect(api.fetchApi).not.toHaveBeenCalled()
    }
  )

  it.for([undefined, null, 'main', 'v1.0.0', '0123456', '../main', 42])(
    'opens without downloading when the catalog has no immutable revision: %s',
    async (revision) => {
      const graph = workflow()
      const result = await prepare(graph, [
        { ...input(), sourceRevision: revision }
      ])
      expect(result).toEqual({ workflow: graph, errors: [] })
      expect(result.workflow).toBe(graph)
      expect(fetch).not.toHaveBeenCalled()
      expect(api.fetchApi).not.toHaveBeenCalled()
    }
  )

  it('uses each catalog revision to download the corresponding sample bytes', async () => {
    const nextRevision = 'abcdef0123456789abcdef0123456789abcdef01'
    vi.mocked(fetch).mockImplementation(async (url) => {
      const path = String(url)
      if (path.includes(`/${sourceRevision}/`)) return new Response('old video')
      if (path.includes(`/${nextRevision}/`)) return new Response('new video')
      throw new Error(`Unexpected sample URL: ${path}`)
    })
    const uploadedBytes: string[] = []
    vi.mocked(api.fetchApi).mockImplementation(async (_route, options) => {
      const body = options?.body
      if (!(body instanceof FormData))
        throw new Error('Expected multipart upload')
      const file = body.get('image')
      if (!(file instanceof File)) throw new Error('Expected a sample file')
      uploadedBytes.push(await file.text())
      return Response.json({ name: 'kitten_cop.mp4' })
    })
    expect((await prepare()).errors).toEqual([])
    expect(
      (
        await prepare(workflow(), [
          { ...input(), sourceRevision: nextRevision }
        ])
      ).errors
    ).toEqual([])
    expect(uploadedBytes).toEqual(['old video', 'new video'])
  })

  it('only fetches declared files that are still used by supported input nodes', async () => {
    const graph = workflow([videoNode(35, 'my_video.mp4')])
    expect(await prepare(graph)).toEqual({ workflow: graph, errors: [] })
    expect(await prepare(workflow(), [])).toEqual({
      errors: [],
      workflow: workflow()
    })
    expect(await prepare(workflow(), [{ ...input(), nodeId: 99 }])).toEqual({
      errors: [],
      workflow: workflow()
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(api.fetchApi).not.toHaveBeenCalled()
  })

  it.for(['../kitten_cop.mp4', 'https://example.com/video.mp4', 'a%2fb.mp4'])(
    'skips unsupported sample filename %s before downloading',
    async (file) => {
      await expect(
        prepare(workflow([videoNode(35, file)]), [input(file)])
      ).resolves.toMatchObject({ errors: [expect.any(Error)] })
      expect(fetch).not.toHaveBeenCalled()
      expect(api.fetchApi).not.toHaveBeenCalled()
    }
  )

  it('does not upload an HTTP error page as a video', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Not found', { status: 404 })
    )
    await expect(prepare()).resolves.toMatchObject({
      errors: [expect.any(Error)]
    })
    expect(api.fetchApi).not.toHaveBeenCalled()
  })

  it.for([
    Response.json({}, { status: 500 }),
    Response.json({ type: 'input' })
  ])(
    'reports an input failure when the backend does not return a saved file',
    async (response) => {
      vi.mocked(api.fetchApi).mockResolvedValue(response)
      await expect(prepare()).resolves.toMatchObject({
        errors: [expect.any(Error)]
      })
    }
  )

  it('keeps successful uploads around failures and malformed declarations', async () => {
    const graph = workflow([
      videoNode(35, 'first.mp4'),
      videoNode(36, 'failed.mp4'),
      videoNode(37, 'last.mp4')
    ])
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).endsWith('/failed.mp4'))
        throw new TypeError('Network unavailable')
      return new Response('video')
    })
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(Response.json({ name: 'first (1).mp4' }))
      .mockResolvedValueOnce(Response.json({ name: 'last (1).mp4' }))
    const result = await prepare(graph, [
      input('first.mp4'),
      { file: 'malformed.mp4' },
      { ...input('failed.mp4'), nodeId: 36 },
      { ...input('last.mp4'), nodeId: 37 }
    ])
    expect(result.errors).toHaveLength(2)
    expect(result.workflow.nodes.map((node) => node.widgets_values)).toEqual([
      ['first (1).mp4', 'image'],
      ['failed.mp4', 'image'],
      ['last (1).mp4', 'image']
    ])
    expect(graph.nodes[0].widgets_values).toEqual(['first.mp4', 'image'])
    expect(api.fetchApi).toHaveBeenCalledTimes(2)
  })

  it.for([
    [],
    [{ file: 'malformed.mp4' }],
    [input('unused.mp4')],
    [{ ...input(), sourceRevision: undefined }]
  ])(
    'does not start progress when no inputs are eligible: %j',
    async (inputs) => {
      const onStart = vi.fn()
      await prepareTemplateInputs(
        workflow(),
        inputs,
        new AbortController().signal,
        false,
        onStart
      )
      expect(onStart).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('starts progress once before the first download', async () => {
    const onStart = vi.fn()
    vi.mocked(fetch).mockImplementation(async () => {
      expect(onStart).toHaveBeenCalledOnce()
      return new Response('video')
    })
    const result = await prepareTemplateInputs(
      workflow(),
      [input()],
      new AbortController().signal,
      false,
      onStart
    )
    expect(result.errors).toEqual([])
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('does not continue an aborted download into an upload', async () => {
    const controller = new AbortController()
    vi.mocked(fetch).mockImplementation(async (_url, options) => {
      controller.abort()
      options?.signal?.throwIfAborted()
      return new Response('unused')
    })
    await expect(
      prepare(workflow(), [input()], controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(api.fetchApi).not.toHaveBeenCalled()
  })
})
