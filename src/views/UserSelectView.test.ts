import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import UserSelectView from './UserSelectView.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

const mockRouterPush = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockRouterPush })
}))

const userStoreMock = vi.hoisted(() => ({
  users: [] as Array<{ userId: string; username: string }>,
  initialize: vi.fn().mockResolvedValue(undefined),
  createUser: vi.fn(),
  login: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('@/stores/userStore', () => ({
  useUserStore: () => userStoreMock
}))

vi.mock('@/views/templates/BaseViewTemplate.vue', () => ({
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
    vi.clearAllMocks()
    userStoreMock.users = []
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
    userStoreMock.createUser.mockResolvedValueOnce(newUser)
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
    userStoreMock.users = [{ userId: 'u1', username: 'bob' }]
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
    userStoreMock.createUser.mockRejectedValueOnce(new Error('boom'))
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
