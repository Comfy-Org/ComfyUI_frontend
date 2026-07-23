import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
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
    resolvedUserInfo: { value: { id: 'user-ada' } }
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
  userId: null,
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

  it('shows the per-user footer actions to an owner', () => {
    renderContent([])
    const link = screen.getByRole('link', { name: /full activity/i })
    expect(link.getAttribute('href')).toBe(
      'https://platform.test/profile/usage'
    )
  })

  it('hides the per-user footer from members', () => {
    mockWorkspaceRole.value = 'member'
    renderContent([])
    expect(screen.queryByRole('link', { name: /full activity/i })).toBeNull()
  })

  it('shows members only their own usage plus workspace credit inflows', async () => {
    mockWorkspaceRole.value = 'member'
    renderContent([
      {
        id: 'own-usage',
        date: new Date('2026-07-14T13:00:00Z'),
        userId: 'user-ada',
        userName: 'Ada Lovelace',
        eventType: 'Own workflow',
        detail: '1 run',
        credits: 100
      },
      {
        id: 'other-usage',
        date: new Date('2026-07-14T10:00:00Z'),
        userId: 'user-other-ada',
        userName: 'Ada Lovelace',
        eventType: 'Other workflow',
        detail: '1 run',
        credits: 200
      },
      creditedRow
    ])

    expect(screen.getByText('Own workflow')).toBeTruthy()
    expect(screen.queryByText('Other workflow')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(screen.getByText('Auto-reload')).toBeTruthy()
  })

  it('marks a credit inflow with a leading plus', () => {
    renderContent([creditedRow])
    expect(screen.getByText(/^\+20,000$/)).toBeTruthy()
  })
})
