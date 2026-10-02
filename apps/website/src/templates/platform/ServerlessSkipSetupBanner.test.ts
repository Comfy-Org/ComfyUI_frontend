import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { deployPromptFor } from '../../config/deploy-prompt'
import ServerlessSkipSetupBanner from './ServerlessSkipSetupBanner.vue'

describe('ServerlessSkipSetupBanner', () => {
  it('copies the full deploy prompt', async () => {
    const user = userEvent.setup()
    render(ServerlessSkipSetupBanner, { props: { locale: 'en' } })

    await user.click(screen.getByRole('button', { name: 'COPY AGENT PROMPT' }))

    expect(await navigator.clipboard.readText()).toBe(deployPromptFor('en'))
    expect(screen.getByRole('button', { name: 'COPIED' })).toBeTruthy()
  })
})
