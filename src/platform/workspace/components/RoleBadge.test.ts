import { mount } from '@vue/test-utils'
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

function mountRoleBadge(role: 'owner' | 'member') {
  return mount(RoleBadge, {
    props: { role },
    global: { plugins: [i18n] }
  })
}

describe('RoleBadge', () => {
  it('renders the owner label', () => {
    const wrapper = mountRoleBadge('owner')
    expect(wrapper.text()).toBe('Owner')
  })

  it('renders the member label', () => {
    const wrapper = mountRoleBadge('member')
    expect(wrapper.text()).toBe('Member')
  })
})
