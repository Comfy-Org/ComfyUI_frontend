import { describe, expect, it } from 'vitest'

import { buildApiSpec } from './apiSpec'
import { SNIPPET_LANGUAGES, buildSnippet } from './apiSnippets'

const spec = buildApiSpec({
  title: 'Portrait Maker',
  workflowId: 'wf_test1',
  parameters: [
    { displayName: 'Prompt', widgetType: 'customtext', value: 'a "cat"' },
    { displayName: 'Tiled', widgetType: 'toggle', value: true }
  ],
  outputs: [{ nodeId: '9', title: 'Save Image' }]
})

describe('buildSnippet', () => {
  it.for(SNIPPET_LANGUAGES)(
    '%s snippet includes all parameters',
    (language) => {
      const snippet = buildSnippet(language, spec)
      expect(snippet).toContain('prompt')
      expect(snippet).toContain('tiled')
    }
  )

  it('curl targets both raw REST endpoints with a valid JSON body', () => {
    const snippet = buildSnippet('curl', spec)
    expect(snippet).toContain(spec.submitUrl)
    expect(snippet).toContain('/jobs/')
    const body = snippet.match(/-d '([\s\S]*?)'/)?.[1]
    expect(body).toBeDefined()
    expect(JSON.parse(body!)).toEqual({ prompt: 'a "cat"', tiled: true })
  })

  it('javascript uses the Comfy client subscribed to the workflow id', () => {
    const snippet = buildSnippet('javascript', spec)
    expect(snippet).toContain('@comfyorg/client')
    expect(snippet).toContain("comfy.subscribe('wf_test1'")
  })

  it('python uses the Comfy client with python literals', () => {
    const snippet = buildSnippet('python', spec)
    expect(snippet).toContain('comfy_client.subscribe(')
    expect(snippet).toContain('"wf_test1"')
    expect(snippet).toContain('"tiled": True')
    expect(snippet).not.toContain('true')
  })

  it.for(SNIPPET_LANGUAGES)(
    '%s snippet mentions the optional webhook',
    (language) => {
      expect(buildSnippet(language, spec).toLowerCase()).toContain('webhook')
    }
  )

  it('shows the upload helper only when a media input exists', () => {
    const mediaSpec = buildApiSpec({
      title: 'Editor',
      workflowId: 'wf_media',
      parameters: [
        {
          displayName: 'Image',
          widgetType: 'combo',
          value: 'photo.png',
          mediaKind: 'image',
          options: { values: ['photo.png'] }
        }
      ],
      outputs: []
    })

    expect(buildSnippet('javascript', mediaSpec)).toContain('storage.upload')
    expect(buildSnippet('python', mediaSpec)).toContain('upload_file')
    expect(buildSnippet('javascript', spec)).not.toContain('storage.upload')
    expect(buildSnippet('python', spec)).not.toContain('upload_file')
  })
})
