import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SettingHelp from './SettingHelp.vue'
import { renderWithTooltipProvider } from '#/testing/renderWithTooltipProvider'

describe('SettingHelp', () => {
  it('explains the setting when its label is hovered', async () => {
    const user = userEvent.setup()
    renderWithTooltipProvider(SettingHelp, {
      props: { text: 'How sharp the brush edge is.' },
      slots: { default: 'Hardness' }
    })

    await user.hover(screen.getByText('Hardness'))

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'How sharp the brush edge is.'
    )
  })
})
