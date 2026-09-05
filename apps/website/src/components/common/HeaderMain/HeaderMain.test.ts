// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import HeaderMain from './HeaderMain.vue'

describe('HeaderMain Workshop navigation', () => {
  it('omits the entry when Workshop is not in the build', () => {
    render(HeaderMain, { props: { showWorkshop: false } })

    expect(screen.queryByRole('link', { name: 'Workshop' })).toBeNull()
  })

  it('adds the entry to both responsive menus when Workshop is in the build', async () => {
    render(HeaderMain, { props: { showWorkshop: true } })

    expect(
      screen.getByRole('link', { name: 'Workshop' }).getAttribute('href')
    ).toBe('/workshop')
    await userEvent.setup().click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.getAllByText('Workshop')).toHaveLength(2)
  })
})
