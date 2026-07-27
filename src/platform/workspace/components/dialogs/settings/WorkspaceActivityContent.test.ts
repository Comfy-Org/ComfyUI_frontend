import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { ActivityEvent } from '@/platform/workspace/composables/useWorkspaceActivity'

import WorkspaceActivityContent from './WorkspaceActivityContent.vue'

const { mockWorkspaceRole } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')
  return {
    mockWorkspaceRole: ref<'owner' | 'member'>('owner')
  }
})

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    workspaceRole: mockWorkspaceRole
  })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    userDisplayName: { value: 'Ada Lovelace' },
    userEmail: { value: 'ada@example.com' }
  })
}))

vi.mock('@/config/comfyApi', () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.test'
}))

class NoopResizeObserver implements ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

function renderContent(events: ActivityEvent[] = []) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(WorkspaceActivityContent, {
    props: { search: '', events },
    global: { plugins: [i18n] }
  })
}

const creditedRow: ActivityEvent = {
  id: 'inflow',
  date: new Date('2026-07-14T12:00:00Z'),
  userName: '',
  eventType: 'Auto-reload',
  detail: '—',
  credits: 20000,
  credited: true
}

describe('WorkspaceActivityContent', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = NoopResizeObserver
    mockWorkspaceRole.value = 'owner'
  })

  it('renders the empty state when there is no activity', () => {
    renderContent([])
    expect(screen.getByText('No activity yet.')).toBeTruthy()
  })

  it('shows the full activity link to an owner', () => {
    renderContent([])
    const link = screen.getByRole('link', { name: /full activity/i })
    expect(link.getAttribute('href')).toBe(
      'https://platform.test/profile/usage'
    )
  })

  it('hides the full activity link from members', () => {
    mockWorkspaceRole.value = 'member'
    renderContent([])
    expect(screen.queryByRole('link', { name: /full activity/i })).toBeNull()
  })

  it('marks a credit inflow with a leading plus', () => {
    renderContent([creditedRow])
    expect(screen.getByText(/^\+20,000$/)).toBeTruthy()
  })
})
