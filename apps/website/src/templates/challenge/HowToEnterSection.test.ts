import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '@/i18n/translations'
import HowToEnterSection from './HowToEnterSection.vue'

const props = {
  signupHref: 'https://example.com/signup',
  submitHref: 'https://example.com/submit'
}

describe('HowToEnterSection', () => {
  it('renders the localized heading and open sign-up step', () => {
    render(HowToEnterSection, { props: { ...props, locale: 'zh-CN' } })

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: t('eventChallenge.enter', {}, { locale: 'zh-CN' })
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: t('eventChallenge.enterSignupLink', {}, { locale: 'zh-CN' })
      })
    ).toHaveAttribute('href', props.signupHref)
  })

  it('numbers the four steps in order', () => {
    render(HowToEnterSection, { props })

    const titles = [
      'enterSignupTitle',
      'enterRequirementsTitle',
      'enterPrepareTitle',
      'enterSubmitTitle'
    ].map((key, index) => `${index + 1}. ${t(`eventChallenge.${key}`)}`)
    for (const name of titles) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it.for([
    { locale: 'en', name: 'Developer Platform', href: '/platform/' },
    { locale: 'zh-CN', name: '开发者平台', href: '/zh-CN/platform/' }
  ] as const)(
    'links the $locale platform requirement to $href',
    async ({ locale, name, href }) => {
      render(HowToEnterSection, { props: { ...props, locale } })

      await userEvent.click(
        screen.getByRole('button', {
          name: `2. ${t('eventChallenge.enterRequirementsTitle', {}, { locale })}`
        })
      )

      expect(await screen.findByRole('link', { name })).toHaveAttribute(
        'href',
        href
      )
    }
  )

  it('lists every other app requirement', async () => {
    render(HowToEnterSection, { props })

    await userEvent.click(
      screen.getByRole('button', {
        name: `2. ${t('eventChallenge.enterRequirementsTitle')}`
      })
    )

    for (const item of [2, 3, 4, 5, 6]) {
      expect(
        await screen.findByText(t(`eventChallenge.requirement${item}`))
      ).toBeInTheDocument()
    }
  })

  it('lists the four deliverables', async () => {
    render(HowToEnterSection, { props })

    await userEvent.click(
      screen.getByRole('button', {
        name: `3. ${t('eventChallenge.enterPrepareTitle')}`
      })
    )

    for (const item of ['Repo', 'Demo', 'Link', 'Social']) {
      expect(
        await screen.findByText(t(`eventChallenge.enter${item}`))
      ).toBeInTheDocument()
    }
  })

  it('stacks sign-up and submit calls to action under the heading', () => {
    render(HowToEnterSection, { props })

    expect(
      screen.getByRole('link', { name: t('eventChallenge.enterSignupCta') })
    ).toHaveAttribute('href', props.signupHref)
    expect(
      screen.getByRole('link', { name: t('eventChallenge.submit') })
    ).toHaveAttribute('href', props.submitHref)
  })

  it('ends the steps with the submit entry call to action', async () => {
    render(HowToEnterSection, { props })

    await userEvent.click(
      screen.getByRole('button', {
        name: `4. ${t('eventChallenge.enterSubmitTitle')}`
      })
    )

    const step = await screen.findByRole('region', {
      name: `4. ${t('eventChallenge.enterSubmitTitle')}`
    })
    expect(
      within(step).getByRole('link', { name: t('eventChallenge.submit') })
    ).toHaveAttribute('href', props.submitHref)
  })
})
