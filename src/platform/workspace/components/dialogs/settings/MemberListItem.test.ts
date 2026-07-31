import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'

import MemberListItem from './MemberListItem.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      subscription: {
        monthlyUsageProgress: '{used} of {total} monthly credits used'
      },
      workspacePanel: {
        members: { columns: { creditsUsed: 'Monthly credits' } }
      }
    }
  }
})

function member(overrides: Partial<WorkspaceMember>): WorkspaceMember {
  return {
    id: '1',
    name: 'Jane',
    email: 'jane@comfy.ai',
    role: 'member',
    joinDate: new Date('2026-01-01'),
    isOriginalOwner: false,
    ...overrides
  }
}

function renderRow(
  props: Pick<
    ComponentProps<typeof MemberListItem>,
    'member' | 'showCreditsColumn'
  >
) {
  return render(MemberListItem, {
    props: {
      isCurrentUser: false,
      gridCols: 'grid-cols-1',
      menuItems: [],
      ...props
    },
    global: { plugins: [i18n], directives: { tooltip: {} } }
  })
}

describe('MemberListItem credits column', () => {
  it('shows used / limit for a capped member', () => {
    renderRow({
      member: member({ creditsUsedThisMonth: 546, monthlyCreditLimit: 3000 }),
      showCreditsColumn: true
    })
    expect(screen.getByText('546 / 3,000')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Monthly credits' })
    ).toHaveAttribute('aria-valuetext', '546 of 3,000 monthly credits used')
  })

  it('shows usage only for an uncapped member', () => {
    renderRow({
      member: member({ creditsUsedThisMonth: 12000, monthlyCreditLimit: null }),
      showCreditsColumn: true
    })
    expect(screen.getByText('12,000')).toBeInTheDocument()
    expect(screen.queryByText(/\//)).not.toBeInTheDocument()
  })

  it('caps the usage bar at 100% when over the limit', () => {
    renderRow({
      member: member({ creditsUsedThisMonth: 5400, monthlyCreditLimit: 5000 }),
      showCreditsColumn: true
    })
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100'
    )
  })

  it('renders a zero-credit cap without dividing by zero', () => {
    renderRow({
      member: member({ creditsUsedThisMonth: 0, monthlyCreditLimit: 0 }),
      showCreditsColumn: true
    })

    expect(screen.getByText('0 / 0')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100'
    )
  })

  it('shows an unknown-usage placeholder without a progress bar', () => {
    renderRow({
      member: member({ monthlyCreditLimit: 3000 }),
      showCreditsColumn: true
    })

    expect(screen.getByText('— / 3,000')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('renders no credits cell when the column is disabled', () => {
    renderRow({
      member: member({ creditsUsedThisMonth: 546, monthlyCreditLimit: 3000 }),
      showCreditsColumn: false
    })
    expect(screen.queryByText('546 / 3,000')).not.toBeInTheDocument()
  })
})
