import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import ReshootDisclosure from './ReshootDisclosure.vue'

describe('ReshootDisclosure', () => {
  it('keeps its controls folded until its label is pressed', async () => {
    render(ReshootDisclosure, {
      props: { label: 'Move' },
      slots: { default: 'Move controls' }
    })
    const details = screen.getByRole('group')

    expect(details).not.toHaveAttribute('open')
    await userEvent.click(screen.getByText('Move'))
    expect(details).toHaveAttribute('open')
  })
})
