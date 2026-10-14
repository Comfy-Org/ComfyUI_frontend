import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import { coachmarkElements } from '@/platform/onboarding/coachmarkRegistry'
import { FIRST_RUN_COACH_IDS } from '@/platform/onboarding/onboardingTours'

import SidebarTemplatesButton from './SidebarTemplatesButton.vue'

describe('SidebarTemplatesButton', () => {
  it('registers an element containing the button as the templates coachmark', () => {
    render(SidebarTemplatesButton, { global: { plugins: [i18n] } })

    const [target] = coachmarkElements(FIRST_RUN_COACH_IDS.templatesButton)

    expect(target).toBeInstanceOf(HTMLElement)
    expect(target).toContainElement(screen.getByRole('button'))
  })
})
