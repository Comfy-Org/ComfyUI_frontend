// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import AuthEmailForm from './AuthEmailForm.vue'

// A controllable Turnstile stand-in: the machine itself is tested in
// @comfyorg/auth-core; here only the gate wiring matters.
const widgetBehavior = vi.hoisted(() => ({
  mode: 'silent' as 'silent' | 'unavailable' | 'token',
  reset: vi.fn()
}))
vi.mock('@comfyorg/auth-core/TurnstileWidget.vue', async () => {
  const { h, onMounted } = await import('vue')
  return {
    default: defineComponent({
      name: 'TurnstileWidgetStub',
      emits: ['update:token', 'update:unavailable'],
      setup(_, { emit, expose }) {
        expose({ reset: widgetBehavior.reset })
        onMounted(() => {
          if (widgetBehavior.mode === 'unavailable') {
            emit('update:unavailable', true)
          }
          if (widgetBehavior.mode === 'token') {
            emit('update:token', 'cf-token')
          }
        })
        return () => h('div', { 'data-testid': 'turnstile-stub' })
      }
    })
  }
})

vi.mock('../../scripts/posthog', async () => {
  const { ref } = await import('vue')
  return { useWorkshopTurnstileMode: () => ref('shadow') }
})

const submitButton = (name: RegExp) => screen.getByRole('button', { name })

beforeEach(() => {
  widgetBehavior.mode = 'silent'
  widgetBehavior.reset.mockReset()
})

describe('AuthEmailForm sign-in', () => {
  it('emits the credentials once they validate', async () => {
    const { emitted } = render(AuthEmailForm, { props: { mode: 'signIn' } })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'hunter2')
    await user.click(submitButton(/Sign in with email/))

    expect(emitted('submit')).toEqual([
      [{ email: 'user@example.com', password: 'hunter2' }]
    ])
  })

  it('renders the field error and emits nothing on an invalid email', async () => {
    const { emitted } = render(AuthEmailForm, { props: { mode: 'signIn' } })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'nope')
    await user.type(screen.getByLabelText('Password'), 'hunter2')
    await user.click(submitButton(/Sign in with email/))

    expect(screen.getByRole('alert').textContent).toContain(
      'Invalid email address'
    )
    expect(emitted('submit')).toBeUndefined()
  })
})

describe('AuthEmailForm sign-up', () => {
  it('holds submission while the challenge is unresolved', () => {
    widgetBehavior.mode = 'silent'
    render(AuthEmailForm, { props: { mode: 'signUp' } })
    expect(
      (submitButton(/Create account/) as HTMLButtonElement).disabled,
      'shadow-waiting: the async challenge must not be raced'
    ).toBe(true)
  })

  it('releases submission when the challenge reports unavailable', async () => {
    widgetBehavior.mode = 'unavailable'
    render(AuthEmailForm, { props: { mode: 'signUp' } })
    await waitFor(() => {
      expect(
        (submitButton(/Create account/) as HTMLButtonElement).disabled
      ).toBe(false)
    })
  })

  it('reports a password mismatch under the confirm field', async () => {
    widgetBehavior.mode = 'token'
    const { emitted } = render(AuthEmailForm, { props: { mode: 'signUp' } })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.type(screen.getByLabelText('Confirm password'), 'Password2!')
    await user.click(submitButton(/Create account/))

    expect(screen.getByRole('alert').textContent).toContain(
      'Passwords must match'
    )
    expect(emitted('submit')).toBeUndefined()
  })

  it('carries the solved challenge token with the credentials', async () => {
    widgetBehavior.mode = 'token'
    const { emitted } = render(AuthEmailForm, { props: { mode: 'signUp' } })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.type(screen.getByLabelText('Confirm password'), 'Password1!')
    await user.click(submitButton(/Create account/))

    expect(emitted('submit')).toEqual([
      [
        {
          email: 'user@example.com',
          password: 'Password1!',
          turnstileToken: 'cf-token'
        }
      ]
    ])
  })
})
