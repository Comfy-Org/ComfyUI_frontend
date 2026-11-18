import { describe, expect, it } from 'vitest'

import { createNamedSignup } from '@/checkout/namedSignup'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value)
  }
}

function refusingStorage(): Storage {
  const refuse = () => {
    throw new Error('storage refused')
  }
  return {
    length: 0,
    clear: refuse,
    getItem: refuse,
    key: refuse,
    removeItem: refuse,
    setItem: refuse
  }
}

const SIGNUP = { operationId: 'op_signup' }

describe('createNamedSignup', () => {
  it('names nothing for a link that names no operation', () => {
    expect(createNamedSignup(() => memoryStorage()).recoverOptions({})).toEqual(
      {}
    )
  })

  it('names the linked signup until this tab pays in its place', () => {
    const named = createNamedSignup(() => memoryStorage())

    expect(named.recoverOptions(SIGNUP)).toEqual({
      operation: { id: 'op_signup', kind: 'subscription' }
    })
    named.replaced(SIGNUP)
    expect(named.recoverOptions(SIGNUP)).toEqual({})
  })

  it('keeps the replacement across a reload of the same tab', () => {
    const storage = memoryStorage()
    createNamedSignup(() => storage).replaced(SIGNUP)

    expect(createNamedSignup(() => storage).recoverOptions(SIGNUP)).toEqual({})
  })

  it('still names a different linked signup after one was replaced', () => {
    const named = createNamedSignup(() => memoryStorage())
    named.replaced(SIGNUP)

    expect(named.recoverOptions({ operationId: 'op_other' })).toEqual({
      operation: { id: 'op_other', kind: 'subscription' }
    })
  })

  it('keeps every signup this tab replaced, across a reload', () => {
    const storage = memoryStorage()
    const named = createNamedSignup(() => storage)
    named.replaced(SIGNUP)
    named.replaced({ operationId: 'op_other' })

    const reloaded = createNamedSignup(() => storage)
    expect(reloaded.recoverOptions(SIGNUP)).toEqual({})
    expect(reloaded.recoverOptions({ operationId: 'op_other' })).toEqual({})
  })

  it('takes the linked signup off the address, keeping the rest of the link', () => {
    const replaced: string[] = []
    const page = {
      location: {
        href: 'https://billing.example/v1/checkout?product=comfyui&plan=pro_monthly&operation=op_signup'
      },
      history: {
        state: null,
        replaceState: (
          _state: unknown,
          _title: string,
          url?: string | URL | null
        ) => void replaced.push(String(url))
      }
    }

    createNamedSignup(() => refusingStorage(), page).replaced(SIGNUP)

    expect(replaced).toEqual([
      'https://billing.example/v1/checkout?product=comfyui&plan=pro_monthly'
    ])
  })

  it('names nothing when storage is refused, so no reload can revive the linked signup', () => {
    expect(
      createNamedSignup(() => refusingStorage()).recoverOptions(SIGNUP)
    ).toEqual({})
  })
})
