// @vitest-environment happy-dom
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
