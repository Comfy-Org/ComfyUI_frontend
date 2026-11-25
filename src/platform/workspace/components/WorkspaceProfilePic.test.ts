import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkspaceProfilePic from './WorkspaceProfilePic.vue'

describe('WorkspaceProfilePic', () => {
  it.for([
    { size: 'default', props: {}, has: ['size-8', 'text-base'] },
    { size: 'small', props: { small: true }, has: ['size-6', 'text-xs'] },
    { size: 'large', props: { large: true }, has: ['size-12', 'text-base'] }
  ])('renders one size class for the $size tile', ({ props, has }) => {
    render(WorkspaceProfilePic, {
      props: { workspaceName: 'qa team', ...props }
    })

    const tile = screen.getByText('Q')
    const sizes = [...tile.classList].filter((name) =>
      /^(size|text)-(\d+|xs|sm|base)$/.test(name)
    )
    expect(sizes).toEqual(expect.arrayContaining(has))
    expect(sizes).toHaveLength(has.length)
  })
})
