import { describe, expect, it } from 'vitest'

import { isRecord } from '@e2e/fixtures/utils/isRecord'

describe('isRecord', () => {
  it.for<[string, unknown, boolean]>([
    ['accepts an empty object', {}, true],
    ['accepts an object with keys', { type: 'doc_ops' }, true],
    ['rejects null', null, false],
    ['rejects undefined', undefined, false],
    ['rejects a string', 'doc_ops', false],
    ['rejects a number', 1, false],
    ['rejects a boolean', true, false],
    ['rejects an empty array', [], false],
    ['rejects an array of objects', [{ op: 'add_node' }], false]
  ])('%s', ([, value, expected]) => {
    expect(isRecord(value)).toBe(expected)
  })
})
