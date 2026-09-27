import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useUserStore } from '@/stores/userStore'

import UserSelectView from './UserSelectView.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

const mockRouterPush = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('vue-router'), () => ({
  useRouter: () => ({ push: mockRouterPush })
}))

let userStoreMock: ReturnType<typeof useUserStore>

vi.mock<unknown>(import('@/views/templates/BaseViewTemplate.vue'), () => ({
  default: {
    name: 'BaseViewTemplate',
    template: '<div><slot /></div>'
  }
}))

const mountView = () =>
  render(UserSelectView, {
    global: {
      plugins: [i18n, PrimeVue]
    }
  })

describe('UserSelectView', () => {
  beforeEach(() => {
    userStoreMock = useUserStore()
    vi.mocked(userStoreMock.initialize).mockResolvedValue(undefined)
    vi.mocked(userStoreMock.login).mockResolvedValue(undefined)
  })

  it('initializes the user store on mount', async () => {
    mountView()

    await waitFor(() =>
      expect(userStoreMock.initialize).toHaveBeenCalledTimes(1)
    )
  })

  it('shows an error when login is attempted without a selection', async () => {
    mountView()

    await userEvent.click(
      screen.getByRole('button', { name: 'userSelect.next' })
    )

    expect(await screen.findByText('No user selected')).toBeInTheDocument()
    expect(userStoreMock.login).not.toHaveBeenCalled()
    expect(mockRouterPush).not.toHaveBeenCalled()
  })

  it('creates a new user, logs in, and navigates home', async () => {
    const newUser = { userId: 'u1', username: 'bob' }
    vi.mocked(userStoreMock.createUser).mockResolvedValueOnce(newUser)
    mountView()

    await userEvent.type(
      screen.getByPlaceholderText('userSelect.enterUsername'),
      'bob'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'userSelect.next' })
    )

    expect(userStoreMock.createUser).toHaveBeenCalledWith('bob')
    expect(userStoreMock.login).toHaveBeenCalledWith(newUser)
    expect(mockRouterPush).toHaveBeenCalledWith('/')
  })

  it('shows an error when the entered username already exists', async () => {
    Object.assign(userStoreMock, { users: [{ userId: 'u1', username: 'bob' }] })
    mountView()

    await userEvent.type(
      screen.getByPlaceholderText('userSelect.enterUsername'),
      'bob'
    )

    expect(
      await screen.findByText('User "bob" already exists')
    ).toBeInTheDocument()
  })

  it('surfaces createUser failures as a login error', async () => {
    vi.mocked(userStoreMock.createUser).mockRejectedValueOnce(new Error('boom'))
    mountView()

    await userEvent.type(
      screen.getByPlaceholderText('userSelect.enterUsername'),
      'bob'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'userSelect.next' })
    )

    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(userStoreMock.login).not.toHaveBeenCalled()
    expect(mockRouterPush).not.toHaveBeenCalled()
  })
})
