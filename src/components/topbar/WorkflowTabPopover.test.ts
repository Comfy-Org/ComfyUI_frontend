import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkflowTabPopover from './WorkflowTabPopover.vue'

const longWorkflowFilename = [
  'client portrait final',
  'SupercalifragilisticexpialidociousUnbreakableWorkflowToken.json'
].join(' ')

describe('WorkflowTabPopover', () => {
  it('shows the full workflow name wrapped in the open popover', async () => {
    render(WorkflowTabPopover, {
      props: {
        anchor: null,
        hovered: false,
        isActiveTab: true,
        open: true,
        workflowFilename: longWorkflowFilename
      }
    })

    const name = await screen.findByText(longWorkflowFilename, {
      selector: 'span'
    })

    expect(name).toHaveTextContent(longWorkflowFilename)
    expect(name).not.toHaveClass('truncate')
    expect(
      name.classList.contains('wrap-anywhere') ||
        name.classList.contains('break-words')
    ).toBe(true)
  })
})
