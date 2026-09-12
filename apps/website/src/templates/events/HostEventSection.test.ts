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

  it('lists the full readiness checklist inside the open first step', () => {
    render(HostEventSection)

    for (const key of ['check1', 'check2', 'check3'] as const) {
      expect(screen.getByText(t(`events.host.step1.${key}`))).toBeTruthy()
    }
    expect(screen.getByText(t('events.host.step1.whoBody'))).toBeTruthy()
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

  it('repeats the apply button inside the application step', async () => {
    render(HostEventSection)

    await userEvent.click(
      screen.getByRole('button', { name: `3. ${t('events.host.step3.title')}` })
    )
    await nextTick()

    expect(screen.getByText(t('events.host.step3.body'))).toBeTruthy()
    const applies = screen.getAllByRole('link', { name: 'Apply to host' })
    expect(applies).toHaveLength(2)
    for (const apply of applies) {
      expect(apply.getAttribute('href')).toBe(
        'https://form.typeform.com/to/Fr2FrB6c'
      )
      expect(apply.getAttribute('target')).toBe('_blank')
    }
  })

  it('describes the toolkit items, with a sub-line only where copy has one', async () => {
    render(HostEventSection)

    await userEvent.click(
      screen.getByRole('button', { name: `4. ${t('events.host.step4.title')}` })
    )
    await nextTick()

    for (const key of ['item1', 'item2', 'item3'] as const) {
      expect(screen.getByText(t(`events.host.step4.${key}.title`))).toBeTruthy()
    }
    expect(screen.getByText(t('events.host.step4.item1.body'))).toBeTruthy()
    expect(screen.getByText(t('events.host.step4.item2.body'))).toBeTruthy()
  })

  it('closes the promotion step with another route to the application', async () => {
    render(HostEventSection)

    await userEvent.click(
      screen.getByRole('button', { name: `5. ${t('events.host.step5.title')}` })
    )
    await nextTick()

    expect(screen.getByText(t('events.host.step5.body'))).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Apply to host' })).toHaveLength(
      2
    )
  })
})
