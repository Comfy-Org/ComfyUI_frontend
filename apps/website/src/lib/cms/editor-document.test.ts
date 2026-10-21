import { describe, expect, it } from 'vitest'
import {
  authoredDocument,
  blankDocument,
  editorSnapshot,
  jsonObject,
  hasReservedFields,
  parseObject,
  objectValue,
  arrayObjects,
  removeInput,
  savePayload,
  setInput
} from './editor-document'

const uid = '00000000-0000-4000-8000-000000000001'
const revision = '00000000-0000-4000-8000-000000000002'
const flat = {
  ...blankDocument(),
  title: 'Example',
  slug: 'example',
  uid,
  type: 'workflow',
  schema_version: 1,
  revision_uid: revision,
  catalog_rev: 2,
  expected_draft_rev: 7,
  expected_revision_uid: revision,
  is_deleted: false,
  owner_uid: uid,
  author_uid: uid,
  saved_by_uid: uid,
  digest: 'hash',
  edit_sequence: 18
}

describe('complete authored documents', () => {
  it('preserves literal JSON keys at every editor parse boundary without prototype setters', () => {
    const text =
      '{"__proto__":{"literal":true},"nested":{"__proto__":"label","constructor":"native","prototype":"value"}}'
    const raw = JSON.parse(text)
    expect(JSON.stringify(parseObject(text))).toBe(text)
    expect(JSON.stringify(objectValue(raw))).toBe(text)
    expect(JSON.stringify(arrayObjects([raw]))).toBe(`[${text}]`)
    expect(JSON.stringify(authoredDocument({ ...flat, ...raw }))).toContain(
      '"__proto__":{"literal":true}'
    )
    const snapshot = editorSnapshot({ ...flat, ...raw })
    expect(snapshot?.document).toEqual({
      ...blankDocument(),
      title: 'Example',
      slug: 'example',
      author_uid: uid,
      ...raw
    })
    expect(Object.getPrototypeOf(parseObject(text))).toBe(Object.prototype)
    expect(Object.hasOwn(Object.prototype, 'literal')).toBe(false)
  })
  it.for([
    undefined,
    NaN,
    Infinity,
    1n,
    new Map<string, string>(),
    new Date(),
    () => 'not JSON'
  ])(
    'rejects non-JSON values instead of stripping or coercing them: %s',
    (value) => {
      expect(jsonObject.safeParse({ unsafe: value }).success).toBe(false)
      expect(
        jsonObject.safeParse(Object.fromEntries([['__proto__', value]])).success
      ).toBe(false)
    }
  )
  it('rejects cycles but permits shared JSON subtrees', () => {
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    expect(jsonObject.safeParse(cycle).success).toBe(false)
    const shared = { label: 'Keep both' }
    expect(objectValue({ a: shared, b: shared })).toEqual({
      a: shared,
      b: shared
    })
  })
  it('separates the selected Draft and record version; strips bookkeeping', () => {
    const snapshot = editorSnapshot(flat)
    expect(snapshot?.expected_draft_rev).toBe(7)
    expect(snapshot?.revision_uid).toBe(revision)
    expect(snapshot?.document).toEqual({
      ...blankDocument(),
      title: 'Example',
      slug: 'example',
      author_uid: uid
    })
    expect(
      savePayload(snapshot!.document, 'workflow', 7, snapshot)
    ).toMatchObject({ expected_draft_rev: 7, expected_revision_uid: revision })
  })
  it('preserves unknown authored structures and exact media pins', () => {
    const fields = {
      translations: { 'zh-CN': { title: '测试' } },
      workflow_files: [
        {
          name: 'Original',
          file: { src: 'r2', id: uid, file_version_uid: revision }
        }
      ],
      inputBindings: { prompt: { path: '$.9.inputs.text' } }
    }
    expect(authoredDocument({ ...flat, ...fields })).toMatchObject(fields)
    expect(
      savePayload({ ...blankDocument(), ...fields }, 'workflow', 7)
    ).toMatchObject(fields)
  })
  it.for([
    { ...flat, is_deleted: 'true' },
    { ...flat, expected_draft_rev: 0 },
    { ...flat, uid: 'slug' },
    { ...flat, type: 'media' }
  ])('rejects an unusable editing snapshot', (raw) => {
    expect(editorSnapshot(raw)).toBeUndefined()
  })
  it('retains the complete tombstone and exact edit token for explicit undelete', () => {
    const snapshot = editorSnapshot({ ...flat, is_deleted: true })
    expect(snapshot).toMatchObject({
      is_deleted: true,
      revision_uid: flat.revision_uid
    })
    expect(snapshot?.document).toEqual(editorSnapshot(flat)?.document)
  })
  it.for(['[]', 'null', '{', 'true'])('rejects non-object JSON: %s', (text) =>
    expect(parseObject(text)).toBeUndefined()
  )
  it('blocks server identity fields in advanced authoring', () => {
    expect(hasReservedFields(blankDocument())).toBe(false)
    expect(hasReservedFields({ uid })).toBe(true)
    expect(hasReservedFields({ owner_uid: uid })).toBe(true)
    expect(hasReservedFields({ author_uid: uid })).toBe(false)
    expect(savePayload({ author_uid: uid }, 'workflow', 7)).toMatchObject({
      author_uid: uid,
      schema_version: 2
    })
  })
  it('drops the server-assigned creator on read and save so edits round-trip', () => {
    const read = { ...flat, creator_uid: uid }
    const snapshot = editorSnapshot(read)
    expect(snapshot?.document).not.toHaveProperty('creator_uid')
    expect(authoredDocument(read)).not.toHaveProperty('creator_uid')
    expect(hasReservedFields({ creator_uid: uid })).toBe(false)
    const payload = savePayload(
      { ...snapshot!.document, creator_uid: uid, title: 'Edited' },
      'workflow',
      7,
      snapshot
    )
    expect(payload).not.toHaveProperty('creator_uid')
    expect(payload).toMatchObject({ title: 'Edited', author_uid: uid })
  })
})

describe('input definitions', () => {
  const definition = {
    label: 'Prompt',
    help: '',
    control: 'text-area',
    advanced: false,
    hidden: false
  }
  it('retains literal option label keys and unrelated nested JSON through an input edit', () => {
    const labels = JSON.parse(
      '{"__proto__":"Literal label","constructor":"Constructor label","normal":"Normal"}'
    )
    const next = setInput(
      {
        ...blankDocument(),
        extras: JSON.parse('{"__proto__":{"retain":true}}')
      },
      'mode',
      { ...definition, control: 'dropdown', optionLabels: labels },
      { type: 'string', enum: ['__proto__', 'constructor', 'normal'] },
      false
    )
    expect(next).toBeDefined()
    expect(objectValue(objectValue(next?.inputs).mode).optionLabels).toEqual(
      labels
    )
    expect(JSON.stringify(next)).toContain('"__proto__":"Literal label"')
    expect(JSON.stringify(next)).toContain('"__proto__":{"retain":true}')
    expect(Object.hasOwn(Object.prototype, 'retain')).toBe(false)
  })
  it.for(['', 2, null])(
    'still rejects invalid literal option labels: %s',
    (label) => {
      expect(
        setInput(
          blankDocument(),
          'mode',
          {
            ...definition,
            control: 'dropdown',
            optionLabels: Object.fromEntries([['__proto__', label]])
          },
          { type: 'string', enum: ['__proto__'] },
          false
        )
      ).toBeUndefined()
    }
  )
  it('edits presentation and parameter schema together without losing other fields', () => {
    const document = {
      ...blankDocument(),
      inputSchema: {
        type: 'object',
        properties: { seed: { type: 'integer' } },
        required: ['seed']
      }
    }
    const next = setInput(
      document,
      'prompt',
      definition,
      { type: 'string', default: 'hello' },
      true
    )
    expect(next?.inputs).toEqual({ prompt: definition })
    expect(next?.inputSchema).toEqual({
      type: 'object',
      properties: {
        seed: { type: 'integer' },
        prompt: { type: 'string', default: 'hello' }
      },
      required: ['seed', 'prompt']
    })
  })
  it.for(['', 'spaces here', '__proto__', 'constructor', 'prototype', '9bad'])(
    'refuses unsafe parameter names: %s',
    (name) => {
      expect(
        setInput(blankDocument(), name, definition, {}, false)
      ).toBeUndefined()
    }
  )
  it('removes the input/schema but preserves bindings and examples for explicit review', () => {
    const next = setInput(
      blankDocument(),
      'prompt',
      definition,
      { type: 'string' },
      true
    )!
    const document = {
      ...next,
      inputBindings: { prompt: { path: '$.3.inputs.text' } },
      examples: [{ values: { prompt: 'Original intent' } }]
    }
    expect(removeInput(document, 'prompt')).toMatchObject({
      inputs: {},
      inputSchema: { properties: {}, required: [] },
      inputBindings: document.inputBindings,
      examples: document.examples
    })
  })
})
