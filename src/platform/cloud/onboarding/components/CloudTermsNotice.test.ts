import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import CloudTermsNotice from './CloudTermsNotice.vue'

function renderNotice(messages: Record<string, object | string>) {
  return render(CloudTermsNotice, {
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
      ]
    }
  })
}

const LONG_LOCALE = {
  auth: {
    login: {
      termsText:
        'Indem Sie auf „Weiter" oder „Registrieren" klicken, erklären Sie sich mit unseren',
      termsLink: 'Nutzungsbedingungen',
      andText: 'und der',
      privacyLink: 'Datenschutzerklärung'
    }
  },
  cloudWaitlist_questionsText: 'Haben Sie Fragen? Kontaktieren Sie uns',
  cloudWaitlist_contactLink: 'hier'
}

describe('CloudTermsNotice', () => {
  it('links to the terms of service and privacy policy', () => {
    renderNotice(enMessages)

    expect(
      screen.getByRole('link', { name: enMessages.auth.login.termsLink })
    ).toHaveAttribute('href', 'https://comfy.org/terms-of-service/')
    expect(
      screen.getByRole('link', { name: enMessages.auth.login.privacyLink })
    ).toHaveAttribute('href', 'https://comfy.org/privacy-policy/')
  })

  it('opens every outbound link safely in a new tab', () => {
    renderNotice(enMessages)

    for (const name of [
      enMessages.auth.login.termsLink,
      enMessages.auth.login.privacyLink,
      enMessages.cloudWaitlist_contactLink
    ]) {
      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute('target', '_blank')
      expect(
        link,
        'target=_blank without noopener hands the opened page a window.opener handle on this sign-in page'
      ).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('offers a support contact link', () => {
    renderNotice(enMessages)

    expect(
      screen.getByRole('link', { name: enMessages.cloudWaitlist_contactLink })
    ).toHaveAttribute('href', 'https://support.comfy.org')
  })

  it('renders every fragment from the locale, not hard-coded copy', () => {
    renderNotice(LONG_LOCALE)

    const inSentence = (needle: string) =>
      screen.getByText((_, element) => {
        if (element?.tagName !== 'P') return false
        return (element.textContent ?? '').replace(/\s+/g, ' ').includes(needle)
      })

    expect(inSentence(LONG_LOCALE.auth.login.termsText)).toBeInTheDocument()
    expect(inSentence(LONG_LOCALE.auth.login.andText)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: LONG_LOCALE.auth.login.termsLink })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: LONG_LOCALE.auth.login.privacyLink })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Privacy Policy' })
    ).not.toBeInTheDocument()
  })

  it('keeps the sentence punctuated once translated', () => {
    renderNotice(LONG_LOCALE)

    expect(
      screen.getByText((_, element) => {
        if (element?.tagName !== 'P') return false
        const text = (element.textContent ?? '').replace(/\s+/g, ' ')
        return text.includes(`${LONG_LOCALE.auth.login.privacyLink}.`)
      }),
      'the trailing period lives in the template, outside the four keys, so a reflow can drop it unnoticed'
    ).toBeInTheDocument()
  })
})
