// @vitest-environment happy-dom
/* eslint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HeroHeadline from './HeroHeadline.vue'

describe('HeroHeadline', () => {
  it('renders the English title as one lockup line per newline', () => {
    render(HeroHeadline)

    expect(screen.getByText('Professional Control')).toBeTruthy()
    expect(screen.getByText('of Visual AI')).toBeTruthy()

    // Two lines wear an end cap on each side, joined by one link piece.
    expect(document.querySelectorAll('img')).toHaveLength(5)
  })

  it('renders the localized title for zh-CN', () => {
    render(HeroHeadline, { props: { locale: 'zh-CN' } })

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      '视觉 AI 的'
    )
  })
})
