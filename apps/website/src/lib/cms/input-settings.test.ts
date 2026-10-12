import { describe, expect, it } from 'vitest'
import type { InputSettingsValue } from './input-settings'
import type { Document } from '@/lib/cms/editor-document'
import {
  buildSettings,
  parseSettingsNumber,
  settingsBuffer,
  settingsMode
} from './input-settings'

const numeric: InputSettingsValue = {
  property: {
    type: 'number',
    minimum: 0,
    maximum: 10,
    default: 0,
    multipleOf: 0.5,
    description: 'Preserve me',
    'x-extra': { exact: ['a', 7, false] }
  },
  presentation: {
    control: 'slider',
    label: 'Guidance',
    help: 'Keep this',
    hidden: false,
    advanced: true,
    unit: 'pixels',
    'x-extra': { nested: true }
  }
}
const options: InputSettingsValue = {
  property: {
    enum: [0, false, 'low'],
    default: false,
    description: 'Typed values',
    'x-schema': ['keep']
  },
  presentation: {
    control: 'dropdown',
    optionLabels: {
      '0': 'Zero',
      false: 'Disabled',
      low: 'Low',
      unrelated: 'Retain this too'
    },
    hidden: true,
    'x-ui': { pin: 'unchanged' }
  }
}
describe('structured input settings', () => {
  it('rejects option values that violate declared type/bounds even when there is no default', () => {
    const base: InputSettingsValue = {
      property: { type: 'integer', enum: [1, 2], maximum: 2 },
      presentation: { control: 'dropdown' }
    }
    const buffer = settingsBuffer(base)
    buffer.options[1].text = '3'
    expect(buildSettings(base, buffer)).toEqual({
      valid: false,
      error: 'optionSchema'
    })
    expect(base.property.enum).toEqual([1, 2])
  })
  it('round trips numeric zero, all unknown fields and presentation unchanged', () => {
    expect(buildSettings(numeric, settingsBuffer(numeric))).toEqual({
      valid: true,
      value: numeric
    })
  })
  it('updates only selected numeric fields and treats blank as explicit removal', () => {
    const buffer = settingsBuffer(numeric)
    buffer.numeric.maximum = '20'
    buffer.numeric.multipleOf = ''
    const expected = { ...numeric.property }
    delete expected.multipleOf
    expect(buildSettings(numeric, buffer)).toEqual({
      valid: true,
      value: {
        property: { ...expected, maximum: 20 },
        presentation: numeric.presentation
      }
    })
    expect(numeric.property.multipleOf).toBe(0.5)
  })
  it.each(['-', '1e', 'NaN', 'Infinity', '0x10', '9007199254740993', '1e309'])(
    'retains invalid numeric buffer %s without emitting a coerced number',
    (text) => {
      const buffer = settingsBuffer(numeric)
      buffer.numeric.maximum = text
      expect(buildSettings(numeric, buffer)).toEqual({
        valid: false,
        error: 'number'
      })
      expect(buffer.numeric.maximum).toBe(text)
      expect(parseSettingsNumber(text)).toBeUndefined()
    }
  )
  it.each(['0', '-1'])('rejects nonpositive step %s', (text) => {
    const buffer = settingsBuffer(numeric)
    buffer.numeric.multipleOf = text
    expect(buildSettings(numeric, buffer)).toEqual({
      valid: false,
      error: 'step'
    })
  })
  it('rejects reversed bounds and defaults that violate range or integer constraints', () => {
    const buffer = settingsBuffer(numeric)
    buffer.numeric.minimum = '11'
    expect(buildSettings(numeric, buffer)).toEqual({
      valid: false,
      error: 'bounds'
    })
    buffer.numeric.minimum = '0'
    buffer.numeric.default = '11'
    expect(buildSettings(numeric, buffer)).toEqual({
      valid: false,
      error: 'default'
    })
    buffer.numeric.default = '1.5'
    expect(
      buildSettings(
        { ...numeric, property: { ...numeric.property, type: 'integer' } },
        buffer
      )
    ).toEqual({ valid: false, error: 'default' })
  })
  it('round trips exact mixed scalar enum/default types and label maps', () => {
    expect(buildSettings(options, settingsBuffer(options))).toEqual({
      valid: true,
      value: options
    })
  })
  it('reorders/removes options without touching surviving typed values, defaults or unrelated labels', () => {
    const buffer = settingsBuffer(options)
    buffer.options = [buffer.options[1], buffer.options[0]]
    expect(buildSettings(options, buffer)).toEqual({
      valid: true,
      value: {
        property: { ...options.property, enum: [false, 0] },
        presentation: {
          ...options.presentation,
          optionLabels: {
            '0': 'Zero',
            false: 'Disabled',
            unrelated: 'Retain this too'
          }
        }
      }
    })
  })
  it('requires explicit default repair when its option is removed', () => {
    const buffer = settingsBuffer(options)
    buffer.options = [buffer.options[0]]
    expect(buildSettings(options, buffer)).toEqual({
      valid: false,
      error: 'default'
    })
    buffer.defaultJSON = ''
    const result = buildSettings(options, buffer)
    expect(result.valid).toBe(true)
    if (!result.valid) throw new Error('Default removal was rejected')
    expect(result.value.property).not.toHaveProperty('default')
  })
  it('refuses duplicate values and scalar/string label collisions', () => {
    const buffer = settingsBuffer(options)
    buffer.options.push({ ...buffer.options[0], key: 'new' })
    expect(buildSettings(options, buffer)).toEqual({
      valid: false,
      error: 'duplicate'
    })
    buffer.options[3].type = 'string'
    expect(buildSettings(options, buffer)).toEqual({
      valid: false,
      error: 'labelCollision'
    })
  })
  it('supports intentionally empty text values and safely represents special string label keys', () => {
    const base: InputSettingsValue = {
      property: { type: 'string', enum: ['', '__proto__'], default: '' },
      presentation: {
        control: 'dropdown',
        optionLabels: Object.fromEntries([['__proto__', 'Prototype text']])
      }
    }
    const result = buildSettings(base, settingsBuffer(base))
    expect(result).toEqual({ valid: true, value: base })
    expect(Object.prototype).not.toHaveProperty('Prototype text')
  })
  it('preserves an explicit empty label map', () => {
    const base: InputSettingsValue = {
      property: { enum: ['a'] },
      presentation: { control: 'dropdown', optionLabels: {} }
    }
    expect(buildSettings(base, settingsBuffer(base))).toEqual({
      valid: true,
      value: base
    })
  })
  it.each<Document>([
    { ...numeric.property, allOf: [{ minimum: 2 }] },
    { ...numeric.property, $ref: '#/number' },
    { type: 'object', enum: [{ width: 100 }] },
    { enum: [1, '1'] }
  ])(
    'keeps unsupported schemas read-only rather than flattening %o',
    (property) => {
      const base: InputSettingsValue = {
        property,
        presentation: { control: 'dropdown' }
      }
      expect(settingsMode(base)).toBe('unsupported')
      expect(buildSettings(base, settingsBuffer(base))).toEqual({
        valid: true,
        value: base
      })
    }
  )
})
it.each<Document>([
  { control: 'dropdown' },
  { control: 'dropdown', optionLabels: {} },
  { control: 'dropdown', optionLabels: { unrelated: 'Keep this' } }
])(
  'leaves inherited-name options unlabeled without an own label in %o',
  (presentation) => {
    const base: InputSettingsValue = {
      property: {
        enum: ['__proto__', 'constructor', 'toString', 'hasOwnProperty']
      },
      presentation
    }
    const buffer = settingsBuffer(base)
    expect(buffer.options.map((option) => option.label)).toEqual([
      '',
      '',
      '',
      ''
    ])
    expect(buildSettings(base, buffer)).toEqual({ valid: true, value: base })
  }
)
