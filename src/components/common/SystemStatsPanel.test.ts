import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { SystemStats } from '@/schemas/apiSchema'

import SystemStatsPanel from './SystemStatsPanel.vue'

const copyToClipboard = vi.fn()
vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function createStats(
  overrides: Partial<SystemStats['system']> = {}
): SystemStats {
  return {
    system: {
      os: 'posix',
      python_version: '3.12.4',
      embedded_python: false,
      comfyui_version: 'v1.2.3',
      pytorch_version: '2.4.0',
      argv: ['main.py', '--listen'],
      ram_total: 1024,
      ram_free: 512,
      installed_templates_version: '1.0.0',
      required_templates_version: '1.0.0',
      ...overrides
    },
    devices: []
  }
}

function renderPanel(stats: SystemStats) {
  return render(SystemStatsPanel, {
    props: { stats },
    global: {
      plugins: [i18n],
      stubs: {
        DeviceInfo: {
          props: ['device'],
          template: '<div>{{ device.name }}</div>'
        }
      }
    }
  })
}

describe('SystemStatsPanel', () => {
  it('renders localized headers with corrected PyTorch casing', () => {
    renderPanel(createStats())

    expect(screen.getByText('PyTorch Version')).toBeTruthy()
    expect(screen.queryByText('Pytorch Version')).toBeNull()
    expect(screen.getByText('OS')).toBeTruthy()
    expect(screen.getByText('Python Version')).toBeTruthy()
    expect(screen.getByText('Arguments')).toBeTruthy()
  })

  it('formats values for display', () => {
    renderPanel(createStats({ ram_total: 1024, argv: ['main.py', '--cpu'] }))

    expect(screen.getByText('1 KB')).toBeTruthy()
    expect(screen.getByText('main.py --cpu')).toBeTruthy()
  })

  it('copies localized, formatted system info to the clipboard', async () => {
    renderPanel(createStats())

    await userEvent.click(screen.getByText(enMessages.g.copySystemInfo))

    expect(copyToClipboard).toHaveBeenCalledTimes(1)
    const copied = copyToClipboard.mock.calls[0][0] as string
    expect(copied).toContain('## System Info')
    expect(copied).toContain('PyTorch Version: 2.4.0')
    expect(copied).toContain('RAM Total: 1 KB')
  })

  it('switches between device tabs', async () => {
    const stats = createStats()
    stats.devices = [
      {
        name: 'GPU 0',
        type: 'cuda',
        index: 0,
        vram_total: 100,
        vram_free: 50,
        torch_vram_total: 100,
        torch_vram_free: 50
      },
      {
        name: 'GPU 1',
        type: 'cuda',
        index: 1,
        vram_total: 100,
        vram_free: 50,
        torch_vram_total: 100,
        torch_vram_free: 50
      }
    ]
    const user = userEvent.setup()
    renderPanel(stats)

    expect(screen.getByText('GPU 0', { selector: 'div' })).toBeVisible()
    expect(screen.queryByText('GPU 1', { selector: 'div' })).toBeNull()

    await user.click(screen.getByRole('tab', { name: 'GPU 1' }))
    expect(screen.getByText('GPU 1', { selector: 'div' })).toBeVisible()
    expect(screen.queryByText('GPU 0', { selector: 'div' })).toBeNull()
  })
})
