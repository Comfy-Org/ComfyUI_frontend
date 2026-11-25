import {
  createAutoApplyClaim,
  isAutoApplyPromoCode
} from '@/checkout/promoAutoApply'

function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value)
  }
}

describe('isAutoApplyPromoCode', () => {
  it.for([
    { code: 'BLACKFRIDAY26', expected: true },
    { code: ' blackfriday26 ', expected: true },
    { code: 'LAUNCH20', expected: false },
    { code: undefined, expected: false }
  ])('$code → $expected', ({ code, expected }) => {
    expect(isAutoApplyPromoCode(code)).toBe(expected)
  })
})

describe('createAutoApplyClaim', () => {
  it('grants one claim per checkout in a tab', () => {
    const storage = memoryStorage()
    const claim = createAutoApplyClaim(
      () => 'checkout-a',
      () => storage
    )

    expect(claim()).toBe(true)
    expect(claim()).toBe(false)
    expect(
      createAutoApplyClaim(
        () => 'checkout-a',
        () => storage
      )()
    ).toBe(false)
  })

  it('grants a claim to a different checkout', () => {
    const storage = memoryStorage()
    createAutoApplyClaim(
      () => 'checkout-a',
      () => storage
    )()

    expect(
      createAutoApplyClaim(
        () => 'checkout-b',
        () => storage
      )()
    ).toBe(true)
  })

  it('remembers every checkout claimed in the tab, not only the latest', () => {
    const storage = memoryStorage()
    createAutoApplyClaim(
      () => 'checkout-a',
      () => storage
    )()
    createAutoApplyClaim(
      () => 'checkout-b',
      () => storage
    )()

    expect(
      createAutoApplyClaim(
        () => 'checkout-a',
        () => storage
      )()
    ).toBe(false)
  })

  it('refuses when storage is unavailable', () => {
    const claim = createAutoApplyClaim(
      () => 'checkout-a',
      () => {
        throw new Error('storage blocked')
      }
    )

    expect(claim()).toBe(false)
  })
})
