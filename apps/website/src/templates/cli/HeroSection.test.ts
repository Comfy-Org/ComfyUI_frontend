import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { translationsFor } from '@/i18n/translations'
import HeroSection from './HeroSection.vue'
import { cliCtas } from './ctas'

describe('CLI hero', () => {
  it.for(['en', 'zh-CN'] as const)(
    'keeps the install and documentation actions for %s',
    (locale) => {
      const { t } = translationsFor(locale)
      const ctas = cliCtas(locale)
      render(HeroSection, { props: { locale } })

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        t('cli.hero.heading').replace(/\s+/g, ' ').trim()
      )
      expect(
        screen
          .getByRole('link', { name: ctas.installCli.label })
          .getAttribute('href')
      ).toBe('#setup')
      const docs = screen.getByRole('link', { name: ctas.docs.label })
      expect(docs.getAttribute('href')).toBe(ctas.docs.href)
      expect(docs.getAttribute('target')).toBe('_blank')
      expect(docs.getAttribute('rel')).toContain('noopener')
    }
  )
})
