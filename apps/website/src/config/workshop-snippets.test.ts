import { describe, expect, it } from 'vitest'

import type { WorkshopField } from './workshop-detail'
import { defaultWorkshopValues } from './workshop-detail'
import { buildWorkshopInput, buildWorkshopSnippet } from './workshop-snippets'

const fields: WorkshopField[] = [
  {
    kind: 'text',
    name: 'prompt',
    label: 'Prompt',
    required: true,
    multiline: true,
    valueType: 'string'
  },
  {
    kind: 'toggle',
    name: 'enhance',
    label: 'Enhance',
    required: false,
    defaultValue: true
  },
  {
    kind: 'media',
    name: 'media_image',
    role: 'image',
    label: 'Image',
    required: false,
    multiple: false,
    accept: 'image'
  }
]

describe('Workshop snippets', () => {
  it('builds Router input and groups media roles', () => {
    expect(
      buildWorkshopInput(fields, {
        prompt: 'A red fox',
        enhance: true,
        media_image: '<reference.png>'
      })
    ).toEqual({
      prompt: 'A red fox',
      enhance: true,
      medias: [{ role: 'image', value: '<reference.png>' }]
    })
  })

  it('creates one media entry per selected file', () => {
    const multipleMedia: WorkshopField = {
      kind: 'media',
      name: 'media_image',
      role: 'image',
      label: 'Image',
      required: false,
      multiple: true,
      accept: 'image'
    }
    expect(
      buildWorkshopInput([multipleMedia], {
        media_image: ['<one.png>', '<two.png>']
      })
    ).toEqual({
      medias: [
        { role: 'image', value: '<one.png>' },
        { role: 'image', value: '<two.png>' }
      ]
    })
  })

  it('uses generated defaults', () => {
    expect(defaultWorkshopValues(fields)).toEqual({
      prompt: undefined,
      enhance: true,
      media_image: undefined
    })
  })

  it.for(['typescript', 'python', 'http'] as const)(
    'builds the %s snippet from the current values',
    (language) => {
      expect(
        buildWorkshopSnippet(language, 'bfl/flux-3', fields, {
          prompt: 'A red fox',
          enhance: true
        })
      ).toMatchSnapshot()
    }
  )

  it('parses complex JSON fields into native input values', () => {
    const complex: WorkshopField[] = [
      {
        kind: 'text',
        name: 'inputs',
        label: 'Inputs',
        required: true,
        multiline: true,
        valueType: 'json'
      }
    ]
    expect(buildWorkshopInput(complex, { inputs: '[{"text":"Hi"}]' })).toEqual({
      inputs: [{ text: 'Hi' }]
    })
  })
})
