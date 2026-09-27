import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import NewBadge from './NewBadge.vue'

describe('NewBadge', () => {
  it.for([
    { variant: 'default', label: undefined, text: 'NEW' },
    { variant: 'beta', label: 'beta' as const, text: 'BETA' }
  ])('reads $text on the $variant badge', ({ label, text }) => {
    render(NewBadge, { props: { locale: 'en', label } })

    expect(screen.getByText(text, { exact: true })).toBeTruthy()
  })
})
