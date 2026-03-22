import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Announcement } from '@/platform/remoteConfig/types'

const mockConfig = vi.hoisted(() => ({
  value: {} as { announcements?: Announcement[] }
}))

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: mockConfig
}))

vi.mock('@/utils/tailwindUtil', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' ')
}))

import AnnouncementBanner from './AnnouncementBanner.vue'

const globalMocks = {
  global: {
    mocks: {
      $t: (key: string) => key
    }
  }
}

describe('AnnouncementBanner', () => {
  beforeEach(() => {
    mockConfig.value = {}
    localStorage.clear()
  })

  it('renders announcements from remoteConfig', () => {
    mockConfig.value = {
      announcements: [
        {
          id: 'test-1',
          message: 'Test announcement',
          severity: 'info',
          dismissible: true
        }
      ]
    }

    const wrapper = mount(AnnouncementBanner, globalMocks)
    expect(wrapper.text()).toContain('Test announcement')
  })

  it('renders nothing when no announcements', () => {
    const wrapper = mount(AnnouncementBanner, globalMocks)
    expect(wrapper.text()).toBe('')
  })

  it('hides announcement after dismiss', async () => {
    mockConfig.value = {
      announcements: [
        {
          id: 'dismiss-me',
          message: 'Will be dismissed',
          severity: 'warning',
          dismissible: true
        }
      ]
    }

    const wrapper = mount(AnnouncementBanner, globalMocks)
    expect(wrapper.text()).toContain('Will be dismissed')

    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).not.toContain('Will be dismissed')
  })

  it('does not show dismiss button when dismissible is false', () => {
    mockConfig.value = {
      announcements: [
        {
          id: 'sticky',
          message: 'Cannot dismiss',
          severity: 'critical',
          dismissible: false
        }
      ]
    }

    const wrapper = mount(AnnouncementBanner, globalMocks)
    expect(wrapper.text()).toContain('Cannot dismiss')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('renders multiple announcements', () => {
    mockConfig.value = {
      announcements: [
        { id: 'a', message: 'First', severity: 'info' },
        { id: 'b', message: 'Second', severity: 'warning' }
      ]
    }

    const wrapper = mount(AnnouncementBanner, globalMocks)
    expect(wrapper.text()).toContain('First')
    expect(wrapper.text()).toContain('Second')
  })

  it('applies correct severity classes', () => {
    mockConfig.value = {
      announcements: [
        { id: 'info-banner', message: 'Info', severity: 'info' },
        { id: 'warn-banner', message: 'Warn', severity: 'warning' },
        { id: 'crit-banner', message: 'Crit', severity: 'critical' }
      ]
    }

    const wrapper = mount(AnnouncementBanner, globalMocks)
    const banners = wrapper.findAll('[role="status"]')

    expect(banners[0].classes()).toContain('bg-blue-600')
    expect(banners[1].classes()).toContain('bg-gold-600')
    expect(banners[2].classes()).toContain('bg-danger-100')
  })
})
