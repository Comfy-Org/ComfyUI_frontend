import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import RoleBadge from './RoleBadge.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      workspaceSwitcher: {
        roleOwner: 'Owner',
        roleMember: 'Member'
      }
    }
  }
})

function renderRoleBadge(role: 'owner' | 'member') {
  return render(RoleBadge, {
    props: { role },
    global: { plugins: [i18n] }
  })
}

describe('RoleBadge', () => {
  it('renders the owner label', () => {
    renderRoleBadge('owner')
    expect(screen.getByText('Owner')).toBeInTheDocument()
  })

  it('renders the member label', () => {
    renderRoleBadge('member')
    expect(screen.getByText('Member')).toBeInTheDocument()
  })
})
