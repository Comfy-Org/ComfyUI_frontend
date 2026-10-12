import type { PromoEntry } from '@/checkout/promoEntry'
import {
  checkoutIdentity,
  codeToRemember,
  createPromoMemory
} from '@/checkout/promoMemory'

const PRO = checkoutIdentity(
  { product: 'comfyui', plan: 'pro_monthly' },
  'ws-team'
)

afterEach(() => {
  sessionStorage.clear()
})

describe('checkoutIdentity', () => {
  it.for<{
    name: string
    other: Parameters<typeof checkoutIdentity>
  }>([
    {
      name: 'another workspace',
      other: [{ product: 'comfyui', plan: 'pro_monthly' }, 'ws-other']
    },
    {
      name: 'another plan',
      other: [{ product: 'comfyui', plan: 'creator_monthly' }, 'ws-team']
    },
    {
      name: 'another team commitment',
      other: [
        { product: 'comfyui', plan: 'pro_monthly', teamCreditStopId: 'stop_2' },
        'ws-team'
      ]
    },
    {
      name: 'an unbound workspace',
      other: [{ product: 'comfyui', plan: 'pro_monthly' }, undefined]
    }
  ])('names $name as a different checkout', ({ other }) => {
    expect(checkoutIdentity(...other)).not.toBe(PRO)
  })
})

describe('codeToRemember', () => {
  it.for<{ entry: PromoEntry; code: string | undefined }>([
    { entry: { kind: 'applied', code: 'LAUNCH20' }, code: 'LAUNCH20' },
    { entry: { kind: 'removing', code: 'LAUNCH20' }, code: 'LAUNCH20' },
    { entry: { kind: 'idle' }, code: undefined },
    { entry: { kind: 'editing', draft: 'LAUNCH20' }, code: undefined },
    { entry: { kind: 'applying', draft: 'LAUNCH20' }, code: undefined },
    {
      entry: { kind: 'rejected', draft: 'LAUNCH20', reason: 'invalid' },
      code: undefined
    }
  ])('$entry.kind remembers $code', ({ entry, code }) => {
    expect(codeToRemember(entry)).toBe(code)
  })
})

describe('createPromoMemory', () => {
  it('recalls the code this checkout kept, across a fresh memory', () => {
    createPromoMemory(() => PRO).keep('LAUNCH20')

    expect(createPromoMemory(() => PRO).recall()).toBe('LAUNCH20')
  })

  it('forgets the code once it is kept as nothing', () => {
    const memory = createPromoMemory(() => PRO)
    memory.keep('LAUNCH20')

    memory.keep(undefined)

    expect(createPromoMemory(() => PRO).recall()).toBeUndefined()
  })

  it('gives another checkout nothing, and drops the stale code', () => {
    createPromoMemory(() => PRO).keep('LAUNCH20')
    const other = checkoutIdentity(
      { product: 'comfyui', plan: 'creator_monthly' },
      'ws-team'
    )

    expect(createPromoMemory(() => other).recall()).toBeUndefined()
    expect(createPromoMemory(() => PRO).recall()).toBeUndefined()
  })

  it.for([
    'not json',
    '{"identity":1,"code":"LAUNCH20"}',
    '{"code":"LAUNCH20"}',
    'null'
  ])('reads a malformed record %s as nothing', (raw) => {
    sessionStorage.setItem('comfy.billing-web.checkout-promo.v1', raw)

    expect(createPromoMemory(() => PRO).recall()).toBeUndefined()
  })

  it('works as an empty memory where storage throws', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    const memory = createPromoMemory(() => PRO, blocked)

    expect(() => memory.keep('LAUNCH20')).not.toThrow()
    expect(memory.recall()).toBeUndefined()
  })

  it('survives a storage that refuses writes', () => {
    const full: Storage = Object.assign(Object.create(sessionStorage), {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
      removeItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      }
    })
    const memory = createPromoMemory(
      () => PRO,
      () => full
    )

    expect(() => memory.keep('LAUNCH20')).not.toThrow()
    expect(() => memory.keep(undefined)).not.toThrow()
  })
})
