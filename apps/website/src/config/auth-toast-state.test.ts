import { beforeEach, describe, expect, it } from 'vitest'

import {
  addToast,
  removeAllToasts,
  removeToast,
  useAuthToasts
} from './auth-toast-state'

const { messages } = useAuthToasts()

beforeEach(removeAllToasts)

describe('auth toast list', () => {
  it('gives each message its own id and keeps duplicates', () => {
    const first = addToast({ severity: 'error', summary: 'Error', detail: 'x' })
    const second = addToast({
      severity: 'error',
      summary: 'Error',
      detail: 'x'
    })

    expect(second.id).not.toBe(first.id)
    expect(
      messages.value.map((message) => message.id),
      'PrimeVue does not de-duplicate identical toasts, so neither does this list'
    ).toEqual([first.id, second.id])
  })

  it('removes exactly the message asked for and ignores unknown ids', () => {
    const kept = addToast({ severity: 'success', summary: 'Ok', detail: 'y' })
    const gone = addToast({ severity: 'warn', summary: 'Warn', detail: 'z' })

    removeToast(gone.id)
    removeToast(999_999)

    expect(messages.value).toEqual([kept])
  })
})
