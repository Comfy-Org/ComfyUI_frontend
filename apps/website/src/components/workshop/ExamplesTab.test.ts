import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { nextTick } from 'vue'

import type { PlaygroundExample } from '../../config/workshop-playground'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import ExamplesTab from './ExamplesTab.vue'

const example = (overrides: Partial<PlaygroundExample>): PlaygroundExample => ({
  id: 'example',
  title: 'Example',
  specs: [],
  values: {},
  outputUrl: 'https://assets.example/output.webp',
  ...overrides
})

it('keeps the audio transport separate from the preset action', async () => {
  const user = userEvent.setup()
  const speech = example({
    id: 'audio',
    title: 'Speech sample',
    values: { text: 'Hello' },
    outputUrl: 'https://assets.example/sample.mp3',
    mediaKind: 'audio'
  })
  const { emitted } = render(ExamplesTab, {
    props: { examples: [speech], galleryLabel: 'Voice' }
  })
  const preset = screen.getByRole('button')
  expect(within(preset).queryByLabelText('Voice: Speech sample')).toBeNull()
  await user.click(screen.getByLabelText('Voice: Speech sample'))
  expect(emitted().open).toBeUndefined()
  await user.click(preset)
  expect(emitted().open).toEqual([[speech]])
})

it('captions each output with the prompt that produced it, and only those', () => {
  render(ExamplesTab, {
    props: {
      galleryLabel: 'FLUX 2 Max',
      examples: [
        example({ id: 'a', title: 'Object Swap', prompt: 'a red fox, dusk' }),
        example({ id: 'b', title: 'Sample 2' })
      ]
    }
  })
  const [prompted, bare] = screen.getAllByRole('figure')
  expect(within(prompted).getByText('a red fox, dusk').tagName).toBe(
    'FIGCAPTION'
  )
  expect(within(prompted).getByRole('img').getAttribute('alt')).toBe(
    'FLUX 2 Max: Object Swap'
  )
  expect(within(bare).queryByTestId('example-prompt')).toBeNull()
  expect(within(bare).getByRole('img').getAttribute('alt')).toBe(
    'FLUX 2 Max example output 2'
  )
})

it('loads no video until the gallery nears the screen, and plays none', async () => {
  stubIntersectionObserver()
  render(ExamplesTab, {
    props: {
      galleryLabel: 'Seedance',
      examples: [
        example({
          title: 'Racer',
          outputUrl: 'https://assets.example/output.mp4',
          mediaKind: 'video'
        })
      ]
    }
  })
  const video = screen.getByLabelText('Seedance: Racer')
  expect(video.getAttribute('preload')).toBe('none')
  await setAllIntersecting(true)
  expect(video.getAttribute('preload')).toBe('metadata')
  await setAllIntersecting(false)
  expect(video.getAttribute('preload')).toBe('metadata')
  expect(video.hasAttribute('autoplay')).toBe(false)
})

it('loads the first frame at once where nothing can watch the screen', async () => {
  const observer = window.IntersectionObserver
  Reflect.deleteProperty(window, 'IntersectionObserver')
  try {
    render(ExamplesTab, {
      props: {
        galleryLabel: 'Seedance',
        examples: [example({ title: 'Racer', mediaKind: 'video' })]
      }
    })
    await nextTick()
    expect(
      screen.getByLabelText('Seedance: Racer').getAttribute('preload')
    ).toBe('metadata')
  } finally {
    window.IntersectionObserver = observer
  }
})

it('asks a video example for a frame it can paint before playback', () => {
  render(ExamplesTab, {
    props: {
      examples: [
        {
          id: 'clip',
          title: 'Sci-fi pilot',
          specs: [],
          values: {},
          outputUrl: 'https://media.example/clip.mp4',
          mediaKind: 'video' as const
        }
      ],
      galleryLabel: 'Sci-fi'
    }
  })
  expect(screen.getByTestId('example-video')).toHaveAttribute(
    'src',
    'https://media.example/clip.mp4#t=0.1'
  )
})
