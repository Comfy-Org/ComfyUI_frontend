import { beforeEach, describe, expect, it } from 'vitest'

import {
  authToast,
  dismissAllAuthToasts,
  dismissAuthToast,
  useAuthToasts
} from './auth-toast-state'

const { toasts } = useAuthToasts()

beforeEach(dismissAllAuthToasts)

describe('auth toast list', () => {
  it('gives each toast its own id and keeps duplicates', () => {
    const first = authToast.error('Error', { description: 'x' })
    const second = authToast.error('Error', { description: 'x' })

    expect(second).not.toBe(first)
    expect(toasts.value.map((toast) => toast.id)).toEqual([first, second])
  })

  it('dismisses exactly the toast asked for and ignores unknown ids', () => {
    const kept = authToast.success('Ok')
    const gone = authToast.warning('Warning')

    dismissAuthToast(gone)
    dismissAuthToast(999_999)

    expect(toasts.value.map((toast) => toast.id)).toEqual([kept])
  })
})
