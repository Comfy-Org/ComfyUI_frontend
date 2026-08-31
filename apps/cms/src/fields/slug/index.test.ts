import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { slugField } from './index'

const field = slugField()

const runBeforeValidate = (args: { value?: string; data?: Record<string, unknown> }) => {
  const hook = field.hooks?.beforeValidate?.[0]
  if (!hook) throw new Error('slugField is missing its beforeValidate hook')
  return hook(fromPartial(args))
}

const runValidate = (value: string | undefined, data: Record<string, unknown>) => {
  const { validate } = field
  if (typeof validate !== 'function') throw new Error('slugField is missing its validate function')
  return validate(fromAny(value), fromPartial({ data }))
}

describe('slugField beforeValidate', () => {
  it('derives the slug from the source field when no value is typed', async () => {
    expect(await runBeforeValidate({ data: { title: 'My Event' } })).toBe('my-event')
  })

  it('formats a typed value instead of the source field', async () => {
    expect(await runBeforeValidate({ value: 'Typed Slug', data: { title: 'My Event' } })).toBe(
      'typed-slug',
    )
  })

  it('resolves a slug that folds to nothing as undefined, never the empty string', async () => {
    expect(await runBeforeValidate({ data: { title: '你好' } })).toBeUndefined()
  })
})

describe('slugField validate', () => {
  it('accepts a slug the hook would store', () => {
    expect(runValidate('My Event', {})).toBe(true)
    expect(runValidate(undefined, { title: 'My Event' })).toBe(true)
  })

  it('rejects when neither value nor source produces a slug', () => {
    expect(runValidate(undefined, { title: '你好' })).toMatch(/Enter a slug/)
    expect(runValidate(undefined, {})).toMatch(/Enter a slug/)
  })
})
