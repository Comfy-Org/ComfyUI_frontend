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
vi.mock('@comfyorg/account/TurnstileWidget.vue', async () => {
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

  it('validates a field as it is typed and disables submit while it is invalid', async () => {
    const { emitted } = render(AuthEmailForm, { props: { mode: 'signIn' } })
    const user = userEvent.setup()

    expect(
      submitButton(/^Sign in$/).disabled,
      'nothing has been validated yet, so nothing blocks the button'
    ).toBe(false)

    await user.type(screen.getByLabelText('Email'), 'nope')
    expect(screen.getByRole('alert').textContent).toContain(
      'Invalid email address'
    )
    expect(submitButton(/^Sign in$/).disabled).toBe(true)

    await user.type(screen.getByLabelText('Email'), '@example.com')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(submitButton(/^Sign in$/).disabled).toBe(false)
    expect(emitted('submit')).toBeUndefined()
  })

  it('validates every field on submit, including ones never touched', async () => {
    const { emitted } = render(AuthEmailForm, { props: { mode: 'signIn' } })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(submitButton(/^Sign in$/))

    expect(screen.getByRole('alert').textContent).toContain('Required')
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

  it('releases submission when the challenge reports unavailable', async () => {
    widgetBehavior.mode = 'unavailable'
    render(AuthEmailForm, { props: { mode: 'signUp' } })
    await waitFor(() => {
      expect(submitButton(/^Sign up$/).disabled).toBe(false)
    })
  })

  it('lists the password rules while the field is focused and marks unmet ones', async () => {
    widgetBehavior.mode = 'token'
    render(AuthEmailForm, { props: { mode: 'signUp' } })
    const user = userEvent.setup()

    expect(screen.queryByText('Password requirements:')).toBeNull()

    await user.type(screen.getByLabelText('Password'), 'short')

    expect(screen.getByText('Password requirements:')).toBeTruthy()
    expect(
      screen.getByText('Must be between 8 and 32 characters').className
    ).toContain('text-red-500')
    expect(
      screen.getByText('Must contain at least one lowercase letter').className
    ).not.toContain('text-red-500')

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
