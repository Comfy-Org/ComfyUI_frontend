// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import AuthEmailForm from './AuthEmailForm.vue'

const widgetBehavior = vi.hoisted(() => ({
  mode: 'silent' as 'silent' | 'unavailable' | 'token',
  reset: vi.fn()
}))
vi.mock<unknown>(import('@comfyorg/account/vue'), async (importOriginal) => {
  const { h, onMounted } = await import('vue')
  return {
    ...(await (importOriginal as () => Promise<object>)()),
    TurnstileWidget: defineComponent({
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

vi.mock<unknown>(import('../../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  return { useWorkshopTurnstileMode: () => ref('shadow') }
})

const submitButton = (name: RegExp) =>
  screen.getByRole('button', { name }) as HTMLButtonElement

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
    await user.click(submitButton(/^Sign in$/))

    expect(emitted('submit')).toEqual([
      [{ email: 'user@example.com', password: 'hunter2' }]
    ])
  })

  it('holds submit until the whole form validates, showing errors only for touched fields', async () => {
    const { emitted } = render(AuthEmailForm, { props: { mode: 'signIn' } })
    const user = userEvent.setup()

    expect(
      submitButton(/^Sign in$/).disabled,
      'the cloud forms disable submit until the form is valid'
    ).toBe(true)

    await user.type(screen.getByLabelText('Email'), 'nope')
    expect(screen.getByRole('alert').textContent).toContain(
      'Invalid email address'
    )
    expect(submitButton(/^Sign in$/).disabled).toBe(true)

    await user.type(screen.getByLabelText('Email'), '@example.com')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      submitButton(/^Sign in$/).disabled,
      'an untouched required field still holds the button, without an error of its own'
    ).toBe(true)

    await user.type(screen.getByLabelText('Password'), 'hunter2')
    expect(submitButton(/^Sign in$/).disabled).toBe(false)
    expect(emitted('submit')).toBeUndefined()
  })

  it('does not emit submit for a malformed email, by button or by Enter', async () => {
    const { emitted } = render(AuthEmailForm, { props: { mode: 'signIn' } })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.click(submitButton(/^Sign in$/))
    await user.type(screen.getByLabelText('Password'), '{Enter}')

    expect(emitted('submit')).toBeUndefined()
  })

  it('reveals and re-masks the password without changing its value', async () => {
    render(AuthEmailForm, { props: { mode: 'signIn' } })
    const user = userEvent.setup()
    const password = screen.getByLabelText('Password') as HTMLInputElement

    await user.type(password, 'hunter2')
    expect(password.type).toBe('password')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password.type).toBe('text')
    expect(password.value).toBe('hunter2')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password.type).toBe('password')
  })

  it('submits on Enter from the password field', async () => {
    const { emitted } = render(AuthEmailForm, { props: { mode: 'signIn' } })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'hunter2{Enter}')

    expect(emitted('submit')).toEqual([
      [{ email: 'user@example.com', password: 'hunter2' }]
    ])
  })

  it('names the fields for the browser the way the cloud form does', () => {
    render(AuthEmailForm, { props: { mode: 'signIn' } })

    const email = screen.getByLabelText('Email')
    expect(email.getAttribute('name')).toBe('email')
    expect(email.getAttribute('autocomplete')).toBe('email')
    const password = screen.getByLabelText('Password')
    expect(password.getAttribute('name')).toBe('password')
    expect(password.getAttribute('autocomplete')).toBe('current-password')
  })

  it('shows a spinner and blocks submit while loading', () => {
    render(AuthEmailForm, { props: { mode: 'signIn', loading: true } })

    const button = screen.getByRole('button', { name: /^Sign in$/ })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
  })
})

describe('AuthEmailForm sign-up', () => {
  it('holds submission while the challenge is unresolved', () => {
    widgetBehavior.mode = 'silent'
    render(AuthEmailForm, { props: { mode: 'signUp' } })
    expect(
      submitButton(/^Sign up$/).disabled,
      'shadow-waiting: the async challenge must not be raced'
    ).toBe(true)
  })

  it('tells assistive tech why submit is held and ties the hint to the button', () => {
    render(AuthEmailForm, { props: { mode: 'signUp' } })

    const hint = screen.getByRole('status')
    expect(hint.textContent).toContain(
      'Complete the verification challenge above to enable sign up.'
    )
    expect(submitButton(/^Sign up$/).getAttribute('aria-describedby')).toBe(
      hint.id
    )
  })

  it('asks the browser for a new password on both sign-up fields', () => {
    render(AuthEmailForm, { props: { mode: 'signUp' } })

    expect(screen.getByLabelText('Password').getAttribute('autocomplete')).toBe(
      'new-password'
    )
    const confirm = screen.getByLabelText('Confirm Password')
    expect(confirm.getAttribute('name')).toBe('confirmPassword')
    expect(confirm.getAttribute('autocomplete')).toBe('new-password')
  })

  it('keeps the sign-up password free of an inline error; the rule list is the feedback', async () => {
    widgetBehavior.mode = 'token'
    render(AuthEmailForm, { props: { mode: 'signUp' } })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Password'), 'short')
    await user.tab()
    await user.tab()

    expect(screen.queryByRole('alert')).toBeNull()
    expect(submitButton(/^Sign up$/).disabled).toBe(true)
  })

  it('releases a valid form when the challenge reports unavailable', async () => {
    widgetBehavior.mode = 'unavailable'
    render(AuthEmailForm, { props: { mode: 'signUp' } })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.type(screen.getByLabelText('Confirm Password'), 'Password1!')

    await waitFor(() => {
      expect(submitButton(/^Sign up$/).disabled).toBe(false)
    })
  })

  it('drops the Turnstile hint from the button once the challenge resolves', async () => {
    widgetBehavior.mode = 'token'
    render(AuthEmailForm, { props: { mode: 'signUp' } })

    await waitFor(() =>
      expect(
        submitButton(/^Sign up$/).getAttribute('aria-describedby')
      ).toBeNull()
    )
  })

  it('lists the password rules only while the field is focused', async () => {
    widgetBehavior.mode = 'token'
    render(AuthEmailForm, { props: { mode: 'signUp' } })
    const user = userEvent.setup()

    expect(screen.queryByText('Password requirements:')).toBeNull()

    await user.type(screen.getByLabelText('Password'), 'short')

    expect(screen.getByText('Password requirements:')).toBeTruthy()
    expect(screen.getByText('Must be between 8 and 32 characters')).toBeTruthy()

    await user.tab()
    expect(
      screen.getByText('Password requirements:'),
      'the mask toggle belongs to the field, so focusing it keeps the list'
    ).toBeTruthy()

    await user.tab()
    expect(
      screen.queryByText('Password requirements:'),
      'the list is a typing aid, hidden once focus leaves the field'
    ).toBeNull()
  })

  it('reports a password mismatch under the confirm field', async () => {
    widgetBehavior.mode = 'token'
    const { emitted } = render(AuthEmailForm, { props: { mode: 'signUp' } })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.type(screen.getByLabelText('Confirm Password'), 'Password2!')

    expect(screen.getByRole('alert').textContent).toContain(
      'Passwords must match'
    )
    expect(submitButton(/^Sign up$/).disabled).toBe(true)
    expect(emitted('submit')).toBeUndefined()
  })

  it('carries the solved challenge token with the credentials', async () => {
    widgetBehavior.mode = 'token'
    const { emitted } = render(AuthEmailForm, { props: { mode: 'signUp' } })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.type(screen.getByLabelText('Confirm Password'), 'Password1!')
    await user.click(submitButton(/^Sign up$/))

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
