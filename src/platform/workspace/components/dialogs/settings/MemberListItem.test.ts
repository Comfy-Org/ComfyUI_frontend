import type { ComponentProps } from 'vue-component-type-helpers'

import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'

import MemberListItem from './MemberListItem.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { you: 'you', moreOptions: 'More options' },
      workspaceSwitcher: { roleOwner: 'Owner', roleMember: 'Member' }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

const baseMember: WorkspaceMember = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  joinDate: new Date('2025-01-01'),
  role: 'owner'
}

const baseProps: ComponentProps<typeof MemberListItem> = {
  member: baseMember,
  isCurrentUser: false,
  gridCols: 'grid-cols-3',
  showRoleBadge: true
}

function renderItem(
  propOverrides?: Partial<ComponentProps<typeof MemberListItem>>
) {
  return render(MemberListItem, {
    props: { ...baseProps, ...propOverrides },
    global: {
      plugins: [i18n],
      stubs: {
        UserAvatar: { template: '<div />' },
        Button: { template: '<button />', props: ['variant', 'size'] }
      }
    }
  })
}

describe('MemberListItem', () => {
  it('shows translated owner badge for owner role', () => {
    renderItem({ member: { ...baseMember, role: 'owner' } })
    expect(screen.getByText('Owner')).toBeInTheDocument()
  })

  it('shows translated member badge for member role', () => {
    renderItem({ member: { ...baseMember, role: 'member' } })
    expect(screen.getByText('Member')).toBeInTheDocument()
  })

  it('hides role badge when showRoleBadge is false', () => {
    renderItem({ showRoleBadge: false })
    expect(screen.queryByText('Owner')).not.toBeInTheDocument()
  })
})
