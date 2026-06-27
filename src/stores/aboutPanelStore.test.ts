import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AboutPageBadge } from '@/types/comfy'
import { useAboutPanelStore } from '@/stores/aboutPanelStore'

interface SystemInfo {
  comfyui_version?: string
  installed_templates_version?: string
  required_templates_version?: string
}

const { dist, stats, exts } = vi.hoisted(() => ({
  dist: { isCloud: false, isDesktop: false },
  stats: { system: {} as SystemInfo },
  exts: { list: [] as { aboutPageBadges?: AboutPageBadge[] }[] }
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return dist.isCloud
  },
  get isDesktop() {
    return dist.isDesktop
  }
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: () => ({
    staticUrls: {
      github: 'https://github.com/comfyanonymous/ComfyUI',
      githubFrontend: 'https://github.com/Comfy-Org/ComfyUI_frontend',
      comfyOrg: 'https://comfy.org',
      discord: 'https://discord.com'
    }
  })
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => ({ getComfyUIVersion: () => '9.9.9' })
}))

vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: () => ({ extensions: exts.list })
}))

vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: () => ({ systemStats: stats })
}))

function label(badges: AboutPageBadge[], includes: string) {
  return badges.find((b) => b.label.includes(includes))
}

beforeEach(() => {
  setActivePinia(createPinia())
  dist.isCloud = false
  dist.isDesktop = false
  stats.system = {}
  exts.list = []
})

describe('aboutPanelStore', () => {
  it('builds the default desktop-less, non-cloud core badges', () => {
    stats.system = { comfyui_version: 'abc1234' }
    const store = useAboutPanelStore()

    const core = label(store.badges, 'ComfyUI ')!
    expect(core.icon).toBe('pi pi-github')
    expect(core.url).toContain('github.com/comfyanonymous')
    expect(label(store.badges, 'ComfyUI_frontend')).toBeDefined()
    expect(label(store.badges, 'Discord')).toBeDefined()
    expect(label(store.badges, 'Templates')).toBeUndefined()
  })

  it('uses cloud url and icon for the core badge when running on cloud', () => {
    dist.isCloud = true
    const store = useAboutPanelStore()

    const core = label(store.badges, 'ComfyUI ')!
    expect(core.icon).toBe('pi pi-cloud')
    expect(core.url).toBe('https://comfy.org')
  })

  it('uses the electron-reported version label on desktop', () => {
    dist.isDesktop = true
    const store = useAboutPanelStore()

    expect(label(store.badges, 'ComfyUI v9.9.9')).toBeDefined()
  })

  it('adds a danger templates badge when the installed version is outdated', () => {
    stats.system = {
      installed_templates_version: '1.0.0',
      required_templates_version: '1.1.0'
    }
    const store = useAboutPanelStore()

    const templates = label(store.badges, 'Templates v1.0.0')!
    expect(templates.severity).toBe('danger')
  })

  it('adds a templates badge without severity when versions match', () => {
    stats.system = {
      installed_templates_version: '1.1.0',
      required_templates_version: '1.1.0'
    }
    const store = useAboutPanelStore()

    const templates = label(store.badges, 'Templates v1.1.0')!
    expect(templates.severity).toBeUndefined()
  })

  it('appends extension badges and tolerates extensions without any', () => {
    exts.list = [
      {
        aboutPageBadges: [{ label: 'My Ext', url: 'https://ext', icon: 'pi' }]
      },
      {} // extension without aboutPageBadges -> ?? [] branch
    ]
    const store = useAboutPanelStore()

    expect(label(store.badges, 'My Ext')).toBeDefined()
  })
})
