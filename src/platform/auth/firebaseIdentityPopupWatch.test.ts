import { expect, it, vi } from 'vitest'

import { createFirebaseIdentity } from '@comfyorg/account-core/firebase'

vi.mock<unknown>(import('@comfyorg/account-core/firebase'), () => ({
  createFirebaseIdentity: vi.fn(() => ({}))
}))

it('watches popup sign-in, so a closed popup is reported at once', async () => {
  await import('./firebaseIdentity')

  expect(createFirebaseIdentity).toHaveBeenCalledWith(
    expect.objectContaining({ watchPopupSignIn: true })
  )
})
