// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { t } from '../../i18n/translations'
import HostEventSection from './HostEventSection.vue'

describe('HostEventSection', () => {
  it('renders the localized accordion content', () => {
    render(HostEventSection, { props: { locale: 'zh-CN' } })

    expect(
      screen.getByRole('heading', { name: t('events.host.title', 'zh-CN') })
    ).toBeTruthy()
    // The first step opens by default, so its body is the localized proof.
    expect(screen.getByText(t('events.host.step1.intro', 'zh-CN'))).toBeTruthy()
  })

  it('points the browse link at the on-page directory', async () => {
    render(HostEventSection)

    await userEvent.click(
      screen.getByRole('button', {
        name: `2. ${t('events.host.step2.title')}`
      })
    )
    await nextTick()

    expect(
      screen
        .getByRole('link', { name: t('events.host.step2.browseLink') })
        .getAttribute('href')
    ).toBe('#events-directory')
  })

  it('sends the apply CTA to the host application form in a new tab', () => {
    render(HostEventSection)

    const apply = screen.getByRole('link', { name: 'Apply to host' })
    expect(apply.getAttribute('href')).toBe(
      'https://form.typeform.com/to/Fr2FrB6c'
    )
    expect(apply.getAttribute('target')).toBe('_blank')
    expect(apply.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
