import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'

import ExamplesTab from './ExamplesTab.vue'

it('keeps the audio transport separate from the preset action', async () => {
  const user = userEvent.setup()
  const example = {
    id: 'audio',
    title: 'Speech sample',
    specs: [],
    values: { text: 'Hello' },
    outputUrl: 'https://assets.example/sample.mp3',
    mediaKind: 'audio' as const
  }
  const { emitted } = render(ExamplesTab, { props: { examples: [example] } })
  const preset = screen.getByRole('button')
  expect(within(preset).queryByLabelText('Speech sample')).toBeNull()
  await user.click(screen.getByLabelText('Speech sample'))
  expect(emitted().open).toBeUndefined()
  await user.click(preset)
  expect(emitted().open).toEqual([[example]])
})

// happy-dom lays nothing out, so the width can only be read off the class here.
// That it comes out to a judgeable size on a real phone is the @mobile spec in
// e2e/workshop.spec.ts; this pins which of the two widths each case picks.
it.for([
  [1, 'w-full'],
  [3, 'w-72']
] as const)('gives %i sample(s) the %s phone width', ([count, width]) => {
  render(ExamplesTab, {
    props: {
      examples: Array.from({ length: count }, (_, index) => ({
        id: `sample-${index}`,
        title: `Sample ${index}`,
        specs: [],
        values: {},
        outputUrl: `https://assets.example/sample-${index}.png`,
        mediaKind: 'image' as const
      }))
    }
  })

  const items = screen.getAllByTestId('example-item')
  expect(items).toHaveLength(count)
  expect(items.every((item) => item.className.includes(width))).toBe(true)
})
