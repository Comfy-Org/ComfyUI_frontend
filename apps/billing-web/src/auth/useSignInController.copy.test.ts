import { assert, onTestFinished } from 'vitest'
import { effectScope, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SignInPort } from '@/auth/useSignInController'
import { useSignInController } from '@/auth/useSignInController'
import en from '@/locales/en/main.json' with { type: 'json' }

function createController(translate?: (key: string) => string) {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const port: SignInPort = {
    user: ref(null),
    failureCode: ref(undefined),
    loadIdentity: async () => undefined,
    establish: async () => ({ status: 'ok' })
  }
  const controller = scope.run(() =>
    useSignInController(() => undefined, port, translate)
  )
  assert.exists(controller)
  return controller
}

describe('sign-in error copy', () => {
  it('renders the default support email without catalog escape syntax', () => {
    const controller = createController()
    controller.state.value = {
      step: 'error',
      classification: { kind: 'signup-blocked', code: 'auth/internal-error' }
    }

    expect(controller.errorMessage.value).toContain('support@comfy.org')
  })

  it('reads error copy through the host translator when its locale changes', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en,
        zh: {
          ...en,
          auth: {
            ...en.auth,
            errors: {
              ...en.auth.errors,
              signupBlocked: "无法注册。请联系 support{'@'}comfy.org。"
            }
          }
        }
      }
    })
    const controller = createController(i18n.global.t)
    controller.state.value = {
      step: 'error',
      classification: { kind: 'signup-blocked', code: 'auth/internal-error' }
    }

    expect(controller.errorMessage.value).toContain('support@comfy.org')

    i18n.global.locale.value = 'zh'

    expect(controller.errorMessage.value).toBe(
      '无法注册。请联系 support@comfy.org。'
    )
  })
})
