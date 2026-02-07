import { describe, expect, it } from 'vitest'

import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

import { getWidgetDefaultValue } from '@/utils/widgetUtil'

describe('getWidgetDefaultValue', () => {
  it('returns undefined for undefined spec', () => {
    expect(getWidgetDefaultValue(undefined)).toBeUndefined()
  })

  it('returns explicit default when provided', () => {
    const spec = { type: 'INT', default: 42 } as InputSpec
    expect(getWidgetDefaultValue(spec)).toBe(42)
  })

  it('returns 0 for INT type without default', () => {
    const spec = { type: 'INT' } as InputSpec
    expect(getWidgetDefaultValue(spec)).toBe(0)
  })

  it('returns 0 for FLOAT type without default', () => {
    const spec = { type: 'FLOAT' } as InputSpec
    expect(getWidgetDefaultValue(spec)).toBe(0)
  })

  it('returns false for BOOLEAN type without default', () => {
    const spec = { type: 'BOOLEAN' } as InputSpec
    expect(getWidgetDefaultValue(spec)).toBe(false)
  })

  it('returns empty string for STRING type without default', () => {
    const spec = { type: 'STRING' } as InputSpec
    expect(getWidgetDefaultValue(spec)).toBe('')
  })

  it('returns first option for array options without default', () => {
    const spec = { type: 'COMBO', options: ['a', 'b', 'c'] } as InputSpec
    expect(getWidgetDefaultValue(spec)).toBe('a')
  })

  it('returns undefined for unknown type without options', () => {
    const spec = { type: 'CUSTOM' } as InputSpec
    expect(getWidgetDefaultValue(spec)).toBeUndefined()
  })
})
