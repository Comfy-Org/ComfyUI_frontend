import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { GeneratedExample } from '@/config/models-catalogue'
import WorkflowExampleCard from './WorkflowExampleCard.vue'

const example: GeneratedExample = {
  name: 'softer-finish',
  title: 'A softer finish for a leather sofa',
  description: 'Give the sofa the fur texture from the material reference.',
  tags: [],
  thumbnailUrl: 'https://example.test/sofa.png',
  mediaKind: 'image',
  values: {}
}

function mountCard(chosen: boolean) {
  const { emitted } = render(WorkflowExampleCard, {
    props: { example, chosen }
  })
  return { card: screen.getByRole('button', { name: /leather sofa/ }), emitted }
}

describe('WorkflowExampleCard', () => {
  it('plays the clip independently of choosing its inputs', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue()
    const { emitted } = render(WorkflowExampleCard, {
      props: {
        example: {
          ...example,
          mediaKind: 'video',
          thumbnailUrl: '/preview-media/6/video/exact'
        },
        poster: '/preview-media/6/still/exact',
        chosen: false
      }
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(play).toHaveBeenCalledOnce()
    expect(emitted('open')).toBeUndefined()
    expect(screen.getByLabelText(example.title)).toHaveAttribute(
      'poster',
      '/preview-media/6/still/exact'
    )
    await user.click(screen.getByRole('button', { name: example.title }))
    expect(emitted('open')).toHaveLength(1)
  })
  it('marks the chosen example the way a model page does', () => {
    const { card } = mountCard(true)
    expect(card).toHaveAttribute('aria-current', 'true')
    expect(screen.getByTestId('workflow-example-chosen')).toBeInTheDocument()
  })

  it('leaves an example nobody chose unmarked', () => {
    const { card } = mountCard(false)
    expect(card).not.toHaveAttribute('aria-current')
    expect(screen.queryByTestId('workflow-example-chosen')).toBeNull()
  })

  it('asks for the example to be opened when clicked', async () => {
    const { card, emitted } = mountCard(false)
    await userEvent.click(card)
    expect(emitted()).toHaveProperty('open')
  })
})
