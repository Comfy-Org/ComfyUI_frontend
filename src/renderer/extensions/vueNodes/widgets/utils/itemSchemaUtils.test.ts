import { describe, expect, it } from 'vitest'

import {
  buildSearchText,
  extractItems,
  getByPath,
  mapToDropdownItem,
  resolveLabel
} from '@/renderer/extensions/vueNodes/widgets/utils/itemSchemaUtils'

describe('getByPath', () => {
  it('returns a top-level value for a plain key', () => {
    expect(getByPath({ name: 'Alice' }, 'name')).toBe('Alice')
  })

  it('traverses nested objects via dot-path', () => {
    expect(getByPath({ profile: { name: 'Alice' } }, 'profile.name')).toBe(
      'Alice'
    )
  })

  it('treats numeric segments as array indices', () => {
    expect(getByPath({ items: ['a', 'b', 'c'] }, 'items.1')).toBe('b')
  })

  it('combines nested objects and array indices', () => {
    const obj = { data: { results: [{ id: 'x' }, { id: 'y' }] } }
    expect(getByPath(obj, 'data.results.1.id')).toBe('y')
  })

  it('returns undefined for a missing top-level key', () => {
    expect(getByPath({ a: 1 }, 'b')).toBeUndefined()
  })

  it('returns undefined when traversing past a null segment', () => {
    expect(getByPath({ a: null }, 'a.b')).toBeUndefined()
  })

  it('returns undefined when the root is null', () => {
    expect(getByPath(null, 'a')).toBeUndefined()
  })

  it('returns undefined when the root is undefined', () => {
    expect(getByPath(undefined, 'a')).toBeUndefined()
  })

  it('returns undefined for an out-of-bounds array index', () => {
    expect(getByPath({ items: ['a'] }, 'items.5')).toBeUndefined()
  })
})

describe('resolveLabel', () => {
  it('resolves a plain dot-path to its value', () => {
    expect(resolveLabel('name', { name: 'Alice' })).toBe('Alice')
  })

  it('resolves a nested dot-path without placeholders', () => {
    expect(resolveLabel('profile.name', { profile: { name: 'Alice' } })).toBe(
      'Alice'
    )
  })

  it('substitutes a single {field} placeholder', () => {
    expect(resolveLabel('Name: {name}', { name: 'Alice' })).toBe('Name: Alice')
  })

  it('substitutes multiple placeholders', () => {
    expect(
      resolveLabel('{first} {last}', { first: 'Alice', last: 'Liddell' })
    ).toBe('Alice Liddell')
  })

  it('substitutes placeholders with dot-paths', () => {
    expect(
      resolveLabel('{profile.name} ({profile.age})', {
        profile: { name: 'Alice', age: 30 }
      })
    ).toBe('Alice (30)')
  })

  it('replaces missing placeholder fields with an empty string', () => {
    expect(resolveLabel('{name} - {missing}', { name: 'Alice' })).toBe(
      'Alice - '
    )
  })

  it('returns an empty string when a plain path resolves to undefined', () => {
    expect(resolveLabel('missing', { a: 1 })).toBe('')
  })

  it('coerces numeric values to strings', () => {
    expect(resolveLabel('{count}', { count: 5 })).toBe('5')
  })
})

describe('mapToDropdownItem', () => {
  it('maps required fields to id and name', () => {
    const item = mapToDropdownItem(
      { voice_id: 'v1', label: 'Roger' },
      { value_field: 'voice_id', label_field: 'label', preview_type: 'image' }
    )

    expect(item).toEqual({
      id: 'v1',
      name: 'Roger',
      description: undefined,
      preview_url: undefined
    })
  })

  it('includes description when description_field is set', () => {
    const item = mapToDropdownItem(
      { id: 'v1', label: 'Roger', desc: 'Laid-back American male' },
      {
        value_field: 'id',
        label_field: 'label',
        description_field: 'desc',
        preview_type: 'image'
      }
    )

    expect(item.description).toBe('Laid-back American male')
  })

  it('includes preview_url when preview_url_field is set', () => {
    const item = mapToDropdownItem(
      { id: 'v1', label: 'Roger', sample: 'https://example.com/a.mp3' },
      {
        value_field: 'id',
        label_field: 'label',
        preview_url_field: 'sample',
        preview_type: 'audio'
      }
    )

    expect(item.preview_url).toBe('https://example.com/a.mp3')
  })

  it('resolves label_field templates with placeholders', () => {
    const item = mapToDropdownItem(
      { id: 'v1', first: 'Alice', last: 'Liddell' },
      {
        value_field: 'id',
        label_field: '{first} {last}',
        preview_type: 'image'
      }
    )

    expect(item.name).toBe('Alice Liddell')
  })

  it('resolves dot-path fields for nested data', () => {
    const item = mapToDropdownItem(
      { task_result: { elements: [{ element_id: 'e1', name: 'Elem' }] } },
      {
        value_field: 'task_result.elements.0.element_id',
        label_field: 'task_result.elements.0.name',
        preview_type: 'image'
      }
    )

    expect(item.id).toBe('e1')
    expect(item.name).toBe('Elem')
  })

  it('stringifies non-string value_field', () => {
    const item = mapToDropdownItem(
      { id: 42, label: 'Answer' },
      { value_field: 'id', label_field: 'label', preview_type: 'image' }
    )

    expect(item.id).toBe('42')
  })

  it('returns an empty string id when value_field is missing', () => {
    const item = mapToDropdownItem(
      { label: 'Orphan' },
      { value_field: 'id', label_field: 'label', preview_type: 'image' }
    )

    expect(item.id).toBe('')
  })
})

describe('extractItems', () => {
  it('returns the full response when responseKey is undefined', () => {
    expect(extractItems([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('extracts items from a top-level key', () => {
    expect(
      extractItems({ voices: [{ id: 'a' }, { id: 'b' }] }, 'voices')
    ).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  it('extracts items via a dot-path', () => {
    expect(extractItems({ data: { items: [1, 2] } }, 'data.items')).toEqual([
      1, 2
    ])
  })

  it('returns an empty array for a valid empty list', () => {
    expect(extractItems([])).toEqual([])
  })

  it('returns null when the path does not exist', () => {
    expect(extractItems({ a: 1 }, 'nonexistent')).toBeNull()
  })

  it('returns null when the path resolves to a non-array', () => {
    expect(
      extractItems({ data: { items: 'not an array' } }, 'data.items')
    ).toBeNull()
  })

  it('returns null when the full response is not an array', () => {
    expect(extractItems({ not: 'array' })).toBeNull()
  })

  it('returns null when response is null', () => {
    expect(extractItems(null)).toBeNull()
  })
})

describe('buildSearchText', () => {
  it('joins multiple fields with a space', () => {
    expect(buildSearchText({ a: 'Hello', b: 'World' }, ['a', 'b'])).toBe(
      'hello world'
    )
  })

  it('lowercases the result', () => {
    expect(buildSearchText({ name: 'ALICE' }, ['name'])).toBe('alice')
  })

  it('drops missing fields', () => {
    expect(buildSearchText({ name: 'Alice' }, ['name', 'missing'])).toBe(
      'alice'
    )
  })

  it('supports dot-path fields', () => {
    expect(
      buildSearchText({ profile: { name: 'Alice', age: 30 } }, [
        'profile.name',
        'profile.age'
      ])
    ).toBe('alice 30')
  })

  it('returns an empty string when all fields are missing', () => {
    expect(buildSearchText({ name: 'Alice' }, ['missing'])).toBe('')
  })
})
