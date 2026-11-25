import {
  autoAppliesCode,
  awaitPromotion,
  createAutoApplyClaim
} from '@/checkout/promoAutoApply'
import { awaitPromoAutoApply } from '@/config/checkoutUi'

vi.mock(import('@/config/checkoutUi'), { spy: true })

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

describe('awaitPromotion', () => {
  it.for([
    {
      flag: true,
      expected: { promotionCode: 'BLACKFRIDAY26', autoApply: true }
    },
    { flag: false, expected: null }
  ])(
    'serves $expected while the stand-in flag reads $flag',
    async ({ flag, expected }) => {
      vi.mocked(awaitPromoAutoApply).mockResolvedValue(flag)

      expect(await awaitPromotion()).toEqual(expected)
    }
  )
})

describe('autoAppliesCode', () => {
  const promotion = { promotionCode: 'BLACKFRIDAY26', autoApply: true }

  it.for([
    {
      name: 'the promotion code',
      promo: promotion,
      code: 'BLACKFRIDAY26',
      expected: true
    },
    {
      name: 'the promotion code in other letters',
      promo: promotion,
      code: ' blackfriday26 ',
      expected: true
    },
    {
      name: 'another code',
      promo: promotion,
      code: 'LAUNCH20',
      expected: false
    },
    { name: 'no code', promo: promotion, code: undefined, expected: false },
    {
      name: 'no promotion',
      promo: null,
      code: 'BLACKFRIDAY26',
      expected: false
    },
    {
      name: 'a promotion that does not auto-apply',
      promo: { ...promotion, autoApply: false },
      code: 'BLACKFRIDAY26',
      expected: false
    }
  ])('$name → $expected', ({ promo, code, expected }) => {
    expect(autoAppliesCode(promo, code)).toBe(expected)
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
