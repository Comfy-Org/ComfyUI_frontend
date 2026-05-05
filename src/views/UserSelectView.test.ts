import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import UserSelectView from './UserSelectView.vue'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const mockRouterPush = vi.fn()
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

const createI18nInstance = () =>
  createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        userSelect: {
          newUser: 'New user',
          enterUsername: 'Enter a username',
          existingUser: 'Existing user',
          selectUser: 'Select a user',
          next: 'Next'
        }
      }
    }
  })

const mountView = async () => {
  const result = render(UserSelectView, {
    global: {
      plugins: [createI18nInstance(), PrimeVue]
    }
  })
  await flushPromises()
  return result
}

describe('UserSelectView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userStoreMock.users = []
  })

  it('initializes the user store on mount', async () => {
    await mountView()

    expect(userStoreMock.initialize).toHaveBeenCalledTimes(1)
  })

  it('shows an error when login is attempted without a selection', async () => {
    await mountView()

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('No user selected')).toBeInTheDocument()
    expect(userStoreMock.login).not.toHaveBeenCalled()
    expect(mockRouterPush).not.toHaveBeenCalled()
  })

  it('creates a new user, logs in, and navigates home', async () => {
    const newUser = { userId: 'u1', username: 'bob' }
    userStoreMock.createUser.mockResolvedValueOnce(newUser)
    await mountView()

    await userEvent.type(screen.getByPlaceholderText('Enter a username'), 'bob')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(userStoreMock.createUser).toHaveBeenCalledWith('bob')
    expect(userStoreMock.login).toHaveBeenCalledWith(newUser)
    expect(mockRouterPush).toHaveBeenCalledWith('/')
  })

  it('shows an error when the entered username already exists', async () => {
    userStoreMock.users = [{ userId: 'u1', username: 'bob' }]
    await mountView()

    await userEvent.type(screen.getByPlaceholderText('Enter a username'), 'bob')

    expect(
      await screen.findByText('User "bob" already exists')
    ).toBeInTheDocument()
  })

  it('surfaces createUser failures as a login error', async () => {
    userStoreMock.createUser.mockRejectedValueOnce(new Error('boom'))
    await mountView()

    await userEvent.type(screen.getByPlaceholderText('Enter a username'), 'bob')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(userStoreMock.login).not.toHaveBeenCalled()
    expect(mockRouterPush).not.toHaveBeenCalled()
  })
})
