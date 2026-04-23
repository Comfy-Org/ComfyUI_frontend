import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import TransformPane from './TransformPane.vue'

describe('TransformPane', () => {
  it('has ph-no-capture class to exclude from PostHog session recording', () => {
    render(TransformPane)
    expect(screen.getByTestId('transform-pane').classList).toContain(
      'ph-no-capture'
    )
  })
})
