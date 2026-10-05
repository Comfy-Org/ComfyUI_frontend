import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ApiFacts from './ApiFacts.vue'

const rows = [{ label: 'Endpoint', value: 'POST /api/prompt', mono: true }]

describe('ApiFacts', () => {
  it('keeps what the call needs beforehand with the facts', () => {
    render(ApiFacts, {
      props: {
        where: 'Comfy Cloud',
        rows,
        note: 'Needs a paid Cloud plan and credits.'
      }
    })
    expect(screen.getByTestId('api-facts-note')).toHaveTextContent(
      'Needs a paid Cloud plan and credits.'
    )
  })

  it('shows no condition line where there is no condition', () => {
    render(ApiFacts, { props: { where: 'Comfy Router', rows } })
    expect(screen.getByText('POST /api/prompt')).toBeTruthy()
    expect(screen.queryByTestId('api-facts-note')).toBeNull()
  })

  it('reads where it runs as the first fact', () => {
    render(ApiFacts, { props: { where: 'Comfy Cloud', rows } })

    expect(
      screen.getAllByRole('term').map((term) => term.textContent.trim())
    ).toEqual(['Runs on', 'Endpoint'])
    expect(screen.getAllByRole('definition')[0]).toHaveTextContent(
      'Comfy Cloud'
    )
  })
})
