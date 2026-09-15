import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { components } from '@/types/comfyRegistryTypes'

import PackStatusMessage from './PackStatusMessage.vue'

type Status =
  | components['schemas']['NodeVersionStatus']
  | components['schemas']['NodeStatus']

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderStatus(statusType: Status, hasCompatibilityIssues = false) {
  return render(PackStatusMessage, {
    props: { statusType, hasCompatibilityIssues },
    global: { plugins: [PrimeVue, i18n] }
  })
}

describe('PackStatusMessage', () => {
  it.for([
    ['NodeVersionStatusActive', 'Active'],
    ['NodeVersionStatusPending', 'Pending'],
    ['NodeVersionStatusFlagged', 'Flagged'],
    ['NodeVersionStatusBanned', 'Banned'],
    ['NodeStatusBanned', 'Banned']
  ] as const)('labels %s as "%s"', ([statusType, expected]) => {
    renderStatus(statusType)
    expect(screen.getByText(expected)).toBeTruthy()
  })

  // A security status is the reason the pack conflicts, so it has to survive the
  // generic conflict label. Before this, a banned or flagged version rendered as
  // "Conflicting" and a user could not tell a rejected version from an
  // unreviewed one.
  it.for([
    ['NodeVersionStatusFlagged', 'Flagged'],
    ['NodeVersionStatusBanned', 'Banned'],
    ['NodeStatusBanned', 'Banned']
  ] as const)(
    'keeps the %s label when compatibility issues are also present',
    ([statusType, expected]) => {
      renderStatus(statusType, true)
      expect(screen.getByText(expected)).toBeTruthy()
      expect(screen.queryByText('Conflicting')).toBeNull()
    }
  )

  it('still shows the generic conflicting label for a non-security status', () => {
    renderStatus('NodeVersionStatusActive', true)
    expect(screen.getByText('Conflicting')).toBeTruthy()
  })

  it('renders flagged at a lower severity than banned', () => {
    const { container: flagged } = renderStatus('NodeVersionStatusFlagged')
    const { container: banned } = renderStatus('NodeVersionStatusBanned')

    expect(flagged.querySelector('.p-message-warn')).toBeTruthy()
    expect(flagged.querySelector('.p-message-error')).toBeNull()
    expect(banned.querySelector('.p-message-error')).toBeTruthy()
  })
})
