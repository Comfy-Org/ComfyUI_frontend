import { assert, describe, expect, it } from 'vitest'

import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useDialogStore } from '@/stores/dialogStore'

await Promise.all([
  import('@/components/dialog/content/SignInContent.vue'),
  import('@/components/dialog/content/UpdatePasswordContent.vue'),
  import('@/components/dialog/header/ComfyOrgHeader.vue')
])

function isCallback(value: unknown): value is () => unknown {
  return typeof value === 'function'
}

function dialogCallback(key: string, prop: string) {
  const dialog = useDialogStore().dialogStack.find((d) => d.key === key)
  assert.exists(dialog, `dialog ${key} is open`)
  const callback = dialog.contentProps[prop]
  assert(isCallback(callback), `${key} has a ${prop} callback`)
  return callback
}

async function requestSignInFromUpdatePasswordDialog() {
  await useAuthDialogs().showUpdatePasswordDialog()
  const signIn = dialogCallback('global-update-password', 'requestSignIn')()
  await expect
    .poll(() => useDialogStore().isDialogOpen('global-signin'))
    .toBe(true)
  return { signIn }
}

describe('update password dialog sign-in request', () => {
  it('resolves true and closes the sign-in dialog when sign-in succeeds', async () => {
    const { signIn } = await requestSignInFromUpdatePasswordDialog()

    dialogCallback('global-signin', 'onSuccess')()

    await expect(signIn).resolves.toBe(true)
    expect(useDialogStore().isDialogOpen('global-signin')).toBe(false)
  })

  it('resolves false when the sign-in dialog is dismissed', async () => {
    const { signIn } = await requestSignInFromUpdatePasswordDialog()

    useDialogStore().closeDialog({ key: 'global-signin' })

    await expect(signIn).resolves.toBe(false)
  })
})
