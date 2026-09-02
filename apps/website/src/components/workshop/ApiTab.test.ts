// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { buildSnippet } from '../../config/workshop-snippets'
import ApiTab from './ApiTab.vue'

const routerId = 'kling/kling-ai'
const values = { prompt: 'a capybara', duration: 5 }

describe('ApiTab', () => {
  it('renders the snippet for the selected language', async () => {
    const user = userEvent.setup()
    render(ApiTab, { props: { routerId, values } })
    expect(
      screen.getByTestId('snippet-python').getAttribute('aria-selected')
    ).toBe('true')
    expect(screen.getByTestId('snippet').textContent).toBe(
      buildSnippet('python', routerId, values)
    )

    await user.click(screen.getByTestId('snippet-typescript'))
    expect(
      screen.getByTestId('snippet-typescript').getAttribute('aria-selected')
    ).toBe('true')
    expect(screen.getByTestId('snippet').textContent).toBe(
      buildSnippet('typescript', routerId, values)
    )

    await user.click(screen.getByTestId('snippet-http'))
    expect(screen.getByTestId('snippet').textContent).toBe(
      buildSnippet('http', routerId, values)
    )
  })
})
