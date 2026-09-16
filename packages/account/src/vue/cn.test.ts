import { describe, expect, it } from 'vitest'

import { cn } from './cn'

describe('cn', () => {
  it.for([
    [
      'a custom font size overrides a stock one',
      'text-sm text-xxs',
      'text-xxs'
    ],
    [
      'a stock font size overrides a custom one',
      'text-xxxs text-lg',
      'text-lg'
    ],
    [
      'max-h-none overrides an arbitrary max height',
      'max-h-[80vh] max-h-none',
      'max-h-none'
    ],
    ['a falsy entry is dropped', ['p-2', false, 'm-1'], 'p-2 m-1']
  ] as const)('%s', ([, input, expected]) => {
    expect(cn(input)).toBe(expected)
  })
})
