import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { ProviderAuthStatus } from '../types'
import DownloadAuthProviderRow from './DownloadAuthProviderRow.vue'

const h = vi.hoisted(() => ({
  isLocal: true,
  statuses: new Map<string, ProviderAuthStatus>(),
  login: vi.fn(),
  logout: vi.fn(),
  fetchStatus: vi.fn(),
  copyToClipboard: vi.fn()
}))

vi.mock('../utils/deployment', () => ({
  isLocalDeployment: () => h.isLocal
}))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: h.copyToClipboard })
}))

vi.mock('../stores/downloadAuthStore', () => ({
  useDownloadAuthStore: () => ({
    isLoading: false,
    statusFor: (provider: string) => h.statuses.get(provider),
    isAuthenticated: (provider: string) => {
      const status = h.statuses.get(provider)
      return !!status && (status.env_key_present || status.logged_in)
    },
    login: h.login,
    logout: h.logout,
    fetchStatus: h.fetchStatus
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false
})

function setStatus(overrides: Partial<ProviderAuthStatus> = {}) {
  h.statuses.set('huggingface', {
    provider: 'huggingface',
    env_key_present: false,
    logged_in: false,
    login_in_progress: false,
    ...overrides
  })
}

function mountRow(initiallyExpanded = false) {
  return render(DownloadAuthProviderRow, {
    props: { provider: 'huggingface', initiallyExpanded },
    global: { plugins: [i18n] }
  })
}

describe('DownloadAuthProviderRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.isLocal = true
    h.statuses = new Map()
  })

  it('shows the env-key state without a log-in or sign-out control', () => {
    setStatus({ env_key_present: true })
    mountRow()

    expect(screen.getByText('API key set on the server')).toBeInTheDocument()
    expect(screen.queryByText('Log in')).not.toBeInTheDocument()
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument()
  })

  it('shows Connected with a sign-out control when logged in via OAuth', async () => {
    setStatus({ logged_in: true })
    mountRow()

    expect(screen.getByText('Connected')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Sign out'))
    expect(h.logout).toHaveBeenCalledWith('huggingface')
  })

  it('offers OAuth login on a local deployment and reveals instructions on fallback', async () => {
    setStatus()
    h.login.mockResolvedValue('needs_env_key')
    mountRow()

    await userEvent.click(screen.getByText('Log in'))
    expect(h.login).toHaveBeenCalledWith('huggingface')
    expect(
      screen.getByText('On the server, set HF_TOKEN and restart ComfyUI:')
    ).toBeInTheDocument()
  })

  it('shows env-var instructions instead of login on a remote deployment', async () => {
    setStatus()
    h.isLocal = false
    mountRow()

    expect(screen.queryByText('Log in')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('How to add an API key'))

    expect(screen.getByText(/running on a remote server/)).toBeInTheDocument()
    expect(screen.getByText('export HF_TOKEN="hf_xxx"')).toBeInTheDocument()

    await userEvent.click(screen.getByTitle('Copy'))
    expect(h.copyToClipboard).toHaveBeenCalledWith('export HF_TOKEN="hf_xxx"')
  })

  it('auto-expands instructions when requested for an unauthenticated provider', () => {
    setStatus()
    mountRow(true)

    expect(
      screen.getByText('On the server, set HF_TOKEN and restart ComfyUI:')
    ).toBeInTheDocument()
  })
})
