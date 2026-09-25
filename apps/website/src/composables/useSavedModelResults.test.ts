import { Blob as NodeBlob } from 'node:buffer'
import { URL } from 'node:url'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it, vi } from 'vitest'
import CinematicModelResults from '../components/workshop/cinematic-studio/CinematicModelResults.vue'
import {
  listModelResults,
  saveModelResult
} from '../lib/workshop/cinematic-studio/model-results'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('URL', URL)
})

function record() {
  return {
    id: 'one',
    name: 'Model run',
    modelSlug: 'test-model',
    createdAt: 1,
    outputs: [
      {
        kind: 'image' as const,
        fileName: 'image.png',
        nsfw: true,
        blob: new Blob(['image'], { type: 'image/png' })
      }
    ]
  }
}

it('gates model media and actions, resets reveal across accounts, and confirms deletion', async () => {
  await saveModelResult('first', record())
  await saveModelResult('second', record())
  const user = userEvent.setup()
  const view = render(CinematicModelResults, { props: { namespace: 'first' } })
  await screen.findByRole('heading', { name: 'Model run' })
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Download' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Animate' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Reveal output' }))
  expect(screen.getByRole('img', { name: 'image.png' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Animate' }))
  expect(view.emitted('animate')[0]).toEqual([
    expect.stringContaining('blob:'),
    'image.png'
  ])
  await view.rerender({ namespace: 'second' })
  await screen.findByRole('heading', { name: 'Model run' })
  expect(screen.queryByRole('img')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Remove result' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(await listModelResults('second')).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Remove result' }))
  await user.click(screen.getAllByRole('button', { name: 'Remove result' })[1])
  await screen.findByText(/No saved model results match/)
  expect(await listModelResults('second')).toEqual([])
  expect(await listModelResults('first')).toHaveLength(1)
})

it('filters multi-output results and offers inert downloads for text and other files', async () => {
  await saveModelResult('first', {
    ...record(),
    outputs: [
      {
        kind: 'audio',
        fileName: 'sound.wav',
        blob: new Blob(['audio'], { type: 'audio/wav' })
      },
      {
        kind: 'text',
        fileName: 'text.html',
        blob: new Blob(['<script>bad()</script>'], { type: 'text/html' })
      }
    ]
  })
  const user = userEvent.setup()
  render(CinematicModelResults, { props: { namespace: 'first' } })
  await screen.findByRole('heading', { name: 'Model run' })
  expect(screen.getAllByRole('link', { name: 'Download' })).toHaveLength(2)
  expect(screen.getByLabelText('sound.wav')).toHaveAttribute('preload', 'none')
  expect(screen.queryByText('<script>bad()</script>')).toBeNull()
  await user.selectOptions(screen.getByRole('combobox'), 'image')
  expect(screen.queryByRole('heading', { name: 'Model run' })).toBeNull()
  await user.selectOptions(screen.getByRole('combobox'), 'text')
  expect(screen.getByRole('heading', { name: 'Model run' })).toBeVisible()
  await user.type(screen.getByRole('searchbox'), 'unmatched')
  expect(screen.queryByRole('heading', { name: 'Model run' })).toBeNull()
})
