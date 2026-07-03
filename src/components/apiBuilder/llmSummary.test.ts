import { describe, expect, it } from 'vitest'

import { buildApiSpec } from './apiSpec'
import { buildLlmSummary } from './llmSummary'

const spec = buildApiSpec({
  title: 'Portrait Maker',
  workflowId: 'wf_test1',
  parameters: [
    { displayName: 'Prompt', widgetType: 'customtext', value: 'a cat' },
    {
      displayName: 'Image',
      widgetType: 'combo',
      value: 'photo.png',
      mediaKind: 'image',
      options: { values: ['photo.png'] }
    },
    {
      displayName: 'Steps',
      widgetType: 'number',
      value: 20,
      options: { precision: 0, min: 1, max: 100 }
    }
  ],
  outputs: [{ nodeId: '9', title: 'Save Image' }]
})

describe('buildLlmSummary', () => {
  const summary = buildLlmSummary(spec)

  it('includes usage examples for all three languages', () => {
    expect(summary).toContain('### cURL')
    expect(summary).toContain('### JavaScript')
    expect(summary).toContain('### Python')
    expect(summary).toContain('@comfyorg/client')
    expect(summary).toContain('comfy_client.subscribe(')
  })

  it('documents parameters with type, requirement, and constraints', () => {
    expect(summary).toContain('**`prompt`** (`string`, _optional_)')
    expect(summary).toContain('**`image`** (`image`, _required_)')
    expect(summary).toContain('Range: `1` to `100`')
    expect(summary).toContain('an HTTPS URL or a base64 data URI')
  })

  it('shows a required-only example when required parameters exist', () => {
    expect(summary).toContain('**Required Parameters Example**')
    const requiredExample = summary
      .split('**Required Parameters Example**')[1]
      .split('```json')[1]
      .split('```')[0]
    expect(JSON.parse(requiredExample)).toEqual({
      image: 'https://example.com/input.png'
    })
  })

  it('omits the required-only example when nothing is required', () => {
    const optionalOnly = buildApiSpec({
      title: 'T',
      workflowId: 'wf_x',
      parameters: [
        { displayName: 'Prompt', widgetType: 'customtext', value: 'a' }
      ],
      outputs: []
    })
    expect(buildLlmSummary(optionalOnly)).not.toContain(
      '**Required Parameters Example**'
    )
  })

  it('documents outputs by response key with an example response', () => {
    expect(summary).toContain('**`save_image`** (`list<Asset>`): Save Image')
    expect(summary).toContain('"job_id"')
  })

  it('lists optional features, including the upload helper for media inputs', () => {
    expect(summary).toContain('## Optional Features')
    expect(summary).toContain('`webhook_url`')
    expect(summary).toContain('comfy.storage.upload(file)')

    const noMedia = buildApiSpec({
      title: 'T',
      workflowId: 'wf_x',
      parameters: [
        { displayName: 'Prompt', widgetType: 'customtext', value: 'a' }
      ],
      outputs: []
    })
    expect(buildLlmSummary(noMedia)).not.toContain('storage.upload')
  })
})
