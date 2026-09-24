import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import RouterProofStripSection from './RouterProofStripSection.vue'

describe('RouterProofStripSection', () => {
  it('keeps the proof caption without a model-logo banner', () => {
    render(RouterProofStripSection, { props: { locale: 'en' } })

    expect(
      screen.getByText(
        'The same models 3M+ ComfyUI users already use, now behind one API.'
      )
    ).toBeTruthy()
    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(screen.queryByText('More models coming soon.')).toBeNull()
  })
})
