import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import RoleBadge from './RoleBadge.vue'

describe('RoleBadge', () => {
  it('renders the label text', () => {
    render(RoleBadge, { props: { label: 'PRO' } })
    expect(screen.getByText('PRO')).toBeInTheDocument()
  })
})
