import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import type { WorkshopField } from './workshop-detail'
import {
  buildWorkshopInput,
  buildWorkshopSnippet,
  workshopIdempotencyKey
} from './workshop-snippets'

/** A fixed key, so the snippets under test stay byte-for-byte comparable. */
const TEST_KEY = '11111111-2222-4333-8444-555555555555'

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

const promptOnly = [
  {
    kind: 'text' as const,
    name: 'prompt',
    label: 'Prompt',
    required: true,
    multiline: true,
    valueType: 'string' as const
  }
]

function executeWithStubCurl(command: string): string[] {
  const output = execFileSync(
    'bash',
    ['-c', `curl() { printf '%s\\0' "$@"; }\n${command}`],
    { encoding: 'utf8' }
  )
  return output.split('\0').filter(Boolean)
}

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
      // A picked file becomes a URL the reader can replace, not `<name>`,
      // which the API would reject.
      medias: [
        {
          role: 'image',
          value: 'https://example.com/replace-with-a-url/reference.png'
        }
      ]
    })
  })

  it('omits unset and empty values without emitting an empty media list', () => {
    expect(buildWorkshopInput(fields, {})).toEqual({})
    expect(
      buildWorkshopInput(fields, {
        prompt: '',
        enhance: undefined,
        media_image: []
      })
    ).toEqual({})
    expect(buildWorkshopInput(fields, { media_image: '' })).toEqual({})
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
        {
          role: 'image',
          value: 'https://example.com/replace-with-a-url/one.png'
        },
        {
          role: 'image',
          value: 'https://example.com/replace-with-a-url/two.png'
        }
      ]
    })
  })

  it.for(['typescript', 'python', 'http'] as const)(
    'builds the %s snippet from the current values',
    (language) => {
      expect(
        buildWorkshopSnippet(
          language,
          'bfl/flux-3',
          fields,
          { prompt: 'A red fox', enhance: true },
          TEST_KEY
        )
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
        valueType: 'json',
        jsonSchema: { type: 'array' }
      }
    ]
    expect(buildWorkshopInput(complex, { inputs: '[{"text":"Hi"}]' })).toEqual({
      inputs: [{ text: 'Hi' }]
    })
  })

  it('preserves invalid JSON as text instead of dropping the input', () => {
    const complex: WorkshopField[] = [
      {
        kind: 'text',
        name: 'inputs',
        label: 'Inputs',
        required: true,
        multiline: true,
        valueType: 'json',
        jsonSchema: { type: 'array' }
      }
    ]

    expect(buildWorkshopInput(complex, { inputs: '[invalid' })).toEqual({
      inputs: '[invalid'
    })
  })

  it('renders empty and populated arrays as Python literals', () => {
    const complex: WorkshopField[] = [
      {
        kind: 'text',
        name: 'inputs',
        label: 'Inputs',
        required: true,
        multiline: true,
        valueType: 'json',
        jsonSchema: { type: 'array' }
      }
    ]

    expect(
      buildWorkshopSnippet(
        'python',
        'example/model',
        complex,
        { inputs: '[]' },
        TEST_KEY
      )
    ).toContain('"inputs": []')
    expect(
      buildWorkshopSnippet(
        'python',
        'example/model',
        complex,
        { inputs: '[true, null, 3]' },
        TEST_KEY
      )
    ).toContain('[\n        True,\n        None,\n        3\n    ]')
  })

  it('preserves an apostrophe in the HTTP request payload', () => {
    const snippet = buildWorkshopSnippet(
      'http',
      'bfl/flux-2-pro',
      promptOnly,
      { prompt: "don't stop" },
      TEST_KEY
    )
    const args = executeWithStubCurl(snippet)
    const dataIndex = args.indexOf('--data')

    expect(dataIndex).toBeGreaterThan(-1)
    expect(JSON.parse(args[dataIndex + 1])).toEqual({ prompt: "don't stop" })
  })

  it.for(['typescript', 'python'] as const)(
    'preserves an untrusted model ID in the %s string literal',
    (language) => {
      const modelId = `bf'l$(printf injected)\`printf injected\`/fl"ux`
      const snippet = buildWorkshopSnippet(
        language,
        modelId,
        promptOnly,
        { prompt: 'A red fox' },
        TEST_KEY
      )

      expect(snippet).toContain(`models.run(${JSON.stringify(modelId)},`)
    }
  )

  it('preserves an untrusted model ID as one HTTP argument', () => {
    const modelId = `bf'l$(printf injected)\`printf injected\`/fl"ux`
    const snippet = buildWorkshopSnippet(
      'http',
      modelId,
      promptOnly,
      { prompt: 'A red fox' },
      TEST_KEY
    )

    expect(executeWithStubCurl(snippet)).toContain(
      `https://api.comfy.org/v2/models/${modelId
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`
    )
  })

  it('sends the same non-empty Idempotency-Key every time the block is run', () => {
    // A retry is re-running the copied block, so the key has to survive that.
    // The first version computed it with `$(uuidgen)`, which is absent from most
    // Linux images: the command failed and the header went out empty, and this
    // suite passed anyway because nothing asserted the value.
    const snippet = buildWorkshopSnippet(
      'http',
      'bfl/flux-2-pro',
      promptOnly,
      { prompt: 'A red fox' },
      TEST_KEY
    )

    const keyFrom = (args: string[]): string | undefined =>
      args
        .find((arg) => arg.startsWith('Idempotency-Key:'))
        ?.slice('Idempotency-Key:'.length)
        .trim()

    const first = keyFrom(executeWithStubCurl(snippet))
    const second = keyFrom(executeWithStubCurl(snippet))

    expect(first).toBe(TEST_KEY)
    expect(second).toBe(first)
  })

  it('needs no command the shell might not have', () => {
    // `uuidgen` is not installed on the Linux images CI runs on. Executing with
    // an empty PATH proves the block depends on no external binary at all.
    const snippet = buildWorkshopSnippet(
      'http',
      'bfl/flux-2-pro',
      promptOnly,
      { prompt: 'A red fox' },
      TEST_KEY
    )
    const output = execFileSync(
      'bash',
      ['-c', `PATH=; curl() { printf '%s\\0' "$@"; }\n${snippet}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    )

    expect(output).toContain(`Idempotency-Key: ${TEST_KEY}`)
  })

  it('mints a distinct v4 UUID per call', () => {
    // One per page load, so two readers never collide on the Router's dedupe.
    const keys = Array.from({ length: 50 }, () => workshopIdempotencyKey())

    for (const key of keys) {
      expect(key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      )
    }
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('encodes reserved characters in model ID path segments', () => {
    const snippet = buildWorkshopSnippet(
      'http',
      'provider/model?variant#one%done',
      promptOnly,
      { prompt: 'A red fox' },
      TEST_KEY
    )

    expect(executeWithStubCurl(snippet)).toContain(
      'https://api.comfy.org/v2/models/provider/model%3Fvariant%23one%25done'
    )
  })
})
