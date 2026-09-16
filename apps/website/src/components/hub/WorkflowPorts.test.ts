import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkflowPorts from './WorkflowPorts.vue'

describe('WorkflowPorts', () => {
  it('pairs every port with the medium it carries', () => {
    render(WorkflowPorts, {
      props: {
        heading: 'Loads',
        rows: [
          { name: 'LoadImage', type: 'image' },
          { name: 'LoadImage 2', type: 'image' }
        ]
      }
    })

    expect(screen.getByRole('heading', { name: 'Loads' })).toBeTruthy()
    expect(screen.getAllByRole('term').map((row) => row.textContent)).toEqual([
      'LoadImage',
      'LoadImage 2'
    ])
    expect(
      screen.getAllByRole('definition').map((row) => row.textContent)
    ).toEqual(['image', 'image'])
  })

  it('keeps its heading when it has nothing to list', () => {
    render(WorkflowPorts, { props: { heading: 'Produces', rows: [] } })

    expect(screen.getByRole('heading', { name: 'Produces' })).toBeTruthy()
    expect(screen.queryAllByRole('term')).toEqual([])
  })
})
