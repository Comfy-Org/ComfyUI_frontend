import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ApiFacts from './ApiFacts.vue'

const rows = [{ label: 'Endpoint', value: 'POST /api/prompt', mono: true }]

describe('ApiFacts', () => {
  it('keeps what the call needs beforehand with the facts', () => {
    render(ApiFacts, {
      props: {
        where: 'Comfy Cloud runs it',
        rows,
        note: 'Needs a paid Cloud plan and available credits.'
      }
    })
    expect(screen.getByTestId('api-facts-note')).toHaveTextContent(
      'Needs a paid Cloud plan and available credits.'
    )
  })

  it('shows no condition line where there is no condition', () => {
    render(ApiFacts, { props: { where: 'Comfy Router runs it', rows } })
    expect(screen.getByText('POST /api/prompt')).toBeTruthy()
    expect(screen.queryByTestId('api-facts-note')).toBeNull()
  })
})
