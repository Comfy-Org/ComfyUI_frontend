import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { ROUTER_MIGRATION_PROMPT } from '../../config/router-migration-prompt'
import RouterMigrationBanner from './RouterMigrationBanner.vue'

describe('RouterMigrationBanner', () => {
  it('copies the full migration prompt', async () => {
    const user = userEvent.setup()
    render(RouterMigrationBanner, { props: { locale: 'en' } })

    expect(screen.queryByRole('link')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'COPY PROMPT' }))

    expect(await navigator.clipboard.readText()).toBe(ROUTER_MIGRATION_PROMPT)
    expect(screen.getByRole('button', { name: 'COPIED' })).toBeTruthy()
  })
})
