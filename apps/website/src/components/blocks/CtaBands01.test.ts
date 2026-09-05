// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import CtaBands01 from './CtaBands01.vue'

type CtaBandsProps = ComponentProps<typeof CtaBands01>

const requiredProps = {
  bands: [
    {
      id: 'fdc',
      label: 'Forward Deployed Creatives',
      text: 'Builders, not advisors.',
      cta: { label: 'CONTACT US', href: '/contact/' }
    }
  ]
} satisfies CtaBandsProps

function renderCtaBands(props: Partial<CtaBandsProps> = {}) {
  return render(CtaBands01, {
    props: { ...requiredProps, ...props }
  })
}

describe('CtaBands01', () => {
  it('renders each band label, text, and CTA link by default', () => {
    renderCtaBands({
      bands: [
        ...requiredProps.bands,
        {
          id: 'platform',
          label: 'DEVELOPER PLATFORM',
          text: 'Run approved workflows as endpoints.',
          cta: { label: 'SEE THE PLATFORM', href: '/api/' }
        }
      ]
    })

    expect(
      screen.getByRole('heading', { name: 'Forward Deployed Creatives' })
    ).toBeTruthy()
    expect(screen.getByText('Builders, not advisors.')).toBeTruthy()
    const contact = screen.getByRole('link', { name: 'CONTACT US' })
    expect(contact.getAttribute('href')).toBe('/contact/')
    const platform = screen.getByRole('link', { name: 'SEE THE PLATFORM' })
    expect(platform.getAttribute('href')).toBe('/api/')
  })

  it('renders the uppercase label treatment by default', () => {
    renderCtaBands()

    const heading = screen.getByRole('heading', {
      name: 'Forward Deployed Creatives'
    })
    expect(heading.className).toContain('uppercase')
  })

  it('drops the uppercase label treatment in the highlight variant', () => {
    renderCtaBands({ variant: 'highlight' })

    const heading = screen.getByRole('heading', {
      name: 'Forward Deployed Creatives'
    })
    expect(heading.className).not.toContain('uppercase')
    const contact = screen.getByRole('link', { name: 'CONTACT US' })
    expect(contact.getAttribute('href')).toBe('/contact/')
  })
})
