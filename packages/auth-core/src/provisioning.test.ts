import { describe, expect, it, vi } from 'vitest'

import {
  signUpWithProvisioning,
  socialSignInWithProvisioning
} from './provisioning'

const credentialWith = (deleteFn = vi.fn(async () => {})) => ({
  user: { delete: deleteFn },
  uid: 'user-1'
})

describe('signUpWithProvisioning', () => {
  it('creates, provisions with the credential, and returns it', async () => {
    const credential = credentialWith()
    const provisionCustomer = vi.fn(async () => {})

    const result = await signUpWithProvisioning({
      createUser: async () => credential,
      provisionCustomer
    })

    expect(result).toBe(credential)
    expect(provisionCustomer).toHaveBeenCalledWith(credential)
    expect(credential.user.delete).not.toHaveBeenCalled()
  })

  it('deletes the just-created user and rethrows when provisioning fails', async () => {
    const credential = credentialWith()
    const failure = new Error('turnstile rejected')

    await expect(
      signUpWithProvisioning({
        createUser: async () => credential,
        provisionCustomer: async () => {
          throw failure
        }
      })
    ).rejects.toBe(failure)

    expect(
      credential.user.delete,
      'an orphaned Firebase user bricks every retry with email-already-in-use'
    ).toHaveBeenCalledOnce()
  })

  it('never lets a rollback failure mask the provisioning error', async () => {
    const rollbackFailure = new Error('delete failed')
    const credential = credentialWith(
      vi.fn(async () => {
        throw rollbackFailure
      })
    )
    const failure = new Error('provisioning failed')
    const onRollbackFailure = vi.fn()

    await expect(
      signUpWithProvisioning({
        createUser: async () => credential,
        provisionCustomer: async () => {
          throw failure
        },
        onRollbackFailure
      })
    ).rejects.toBe(failure)

    expect(onRollbackFailure).toHaveBeenCalledWith(rollbackFailure)
  })

  it('surfaces the provisioning error even when the rollback sink itself throws', async () => {
    const credential = credentialWith(
      vi.fn(async () => {
        throw new Error('delete failed')
      })
    )
    const failure = new Error('turnstile rejected')

    await expect(
      signUpWithProvisioning({
        createUser: async () => credential,
        provisionCustomer: async () => {
          throw failure
        },
        onRollbackFailure: () => {
          throw new Error('telemetry sink blew up')
        }
      }),
      'the caller must learn why signup failed, not why logging it failed'
    ).rejects.toBe(failure)
  })

  it('does not provision when user creation itself fails', async () => {
    const failure = new Error('email already in use')
    const provisionCustomer = vi.fn(async () => {})

    await expect(
      signUpWithProvisioning({
        createUser: async () => {
          throw failure
        },
        provisionCustomer
      })
    ).rejects.toBe(failure)

    expect(provisionCustomer).not.toHaveBeenCalled()
  })
})

describe('socialSignInWithProvisioning', () => {
  it('always provisions after a successful popup and returns the credential', async () => {
    const credential = { uid: 'user-1' }
    const provisionCustomer = vi.fn(async () => {})

    const result = await socialSignInWithProvisioning({
      signIn: async () => credential,
      provisionCustomer
    })

    expect(result).toBe(credential)
    expect(
      provisionCustomer,
      'a social user whose first touch is this host has no customer record without it'
    ).toHaveBeenCalledWith(credential)
  })

  it('propagates a provisioning failure without any rollback of the account', async () => {
    const failure = new Error('customers endpoint down')

    await expect(
      socialSignInWithProvisioning({
        signIn: async () => ({ uid: 'user-1' }),
        provisionCustomer: async () => {
          throw failure
        }
      })
    ).rejects.toBe(failure)
  })

  it('does not provision when the popup fails or is dismissed', async () => {
    const provisionCustomer = vi.fn(async () => {})

    await expect(
      socialSignInWithProvisioning({
        signIn: async () => {
          throw new Error('auth/popup-closed-by-user')
        },
        provisionCustomer
      })
    ).rejects.toThrow()

    expect(provisionCustomer).not.toHaveBeenCalled()
  })
})
