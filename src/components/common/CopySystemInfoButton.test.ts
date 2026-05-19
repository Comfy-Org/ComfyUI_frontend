import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { SystemStats } from '@/schemas/apiSchema'

const mockCopySystemInfo = vi.fn()

vi.mock('@/composables/useCopySystemInfo', () => ({
  useCopySystemInfo: () => ({ copySystemInfo: mockCopySystemInfo })
}))

import CopySystemInfoButton from './CopySystemInfoButton.vue'

const stats: SystemStats = {
  system: {
    os: 'Linux',
    python_version: '3.11.5',
    embedded_python: false,
    comfyui_version: 'v0.3.0',
    pytorch_version: '2.1.0',
    argv: ['main.py'],
    ram_total: 16_000_000_000,
    ram_free: 8_000_000_000
  },
  devices: []
}

function renderComponent() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  return render(CopySystemInfoButton, {
    props: { stats },
    global: { plugins: [i18n] }
  })
}

describe('CopySystemInfoButton', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders the localized label', () => {
    renderComponent()
    expect(screen.getByRole('button')).toHaveTextContent('Copy System Info')
  })

  it('invokes copySystemInfo when clicked', async () => {
    const user = userEvent.setup()
    renderComponent()
    await user.click(screen.getByRole('button'))
    expect(mockCopySystemInfo).toHaveBeenCalledTimes(1)
  })
})
