import userEvent from '@testing-library/user-event'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { RunOutput, RunState } from '../../config/workshop-run'
import PlaygroundOutput from './PlaygroundOutput.vue'
import { downloadOutput } from '../../config/workshop-output-download'

vi.mock(import('../../config/workshop-output-download'), () => ({
  downloadOutput: vi.fn(async () => true)
}))

const output = (name: string): RunOutput => ({
  kind: 'image',
  url: `https://example.com/${name}.webp`,
  fileName: `${name}.webp`
})

const succeeded = (out: RunOutput, nsfw = false): RunState => ({
  status: 'succeeded',
  output: out,
  completedAt: 1_000,
  expiresAt: 100_000,
  nsfw
})

describe('PlaygroundOutput', () => {
  it('uses a signed download without buffering media and refreshes an expired link', async () => {
    const user = userEvent.setup()
    const media = {
      ...output('signed'),
      id: 'primary',
      download: { url: 'https://storage.example/download', expiresAt: 5000 }
    }
    const view = render(PlaygroundOutput, {
      props: {
        modelName: 'Workflow',
        now: 2000,
        state: {
          status: 'succeeded',
          output: media,
          completedAt: 1000,
          nsfw: false
        }
      }
    })
    const download = screen.getByRole('link', { name: 'Download' })
    let followsLink = false
    download.addEventListener('click', (event) => {
      followsLink = !event.defaultPrevented
      event.preventDefault()
    })
    expect(download).toHaveAttribute('href', media.download.url)
    await user.click(download)
    expect(followsLink).toBe(true)
    expect(downloadOutput).not.toHaveBeenCalled()
    await view.rerender({ now: 6000 })
    expect(screen.getByRole('img', { name: 'Output' })).toHaveAttribute(
      'src',
      media.url
    )
    await user.click(
      screen.getByRole('link', { name: 'Refresh download link' })
    )
    expect(view.emitted().refresh).toEqual([[media.url]])
    expect(view.emitted().retry).toBeUndefined()
    expect(downloadOutput).not.toHaveBeenCalled()
  })

  it('keeps the selected file while its link is renewed and expires files independently', async () => {
    const user = userEvent.setup()
    const primary = { ...output('first'), id: 'first', expiresAt: 3000 }
    const second = { ...output('second'), id: 'second', expiresAt: 10000 }
    const state: RunState = {
      status: 'succeeded',
      output: primary,
      completedAt: 1000,
      nsfw: false
    }
    const view = render(PlaygroundOutput, {
      props: { modelName: 'Workflow', state, attachments: [second], now: 2000 }
    })
    await user.click(screen.getByRole('button', { name: 'Image 2' }))
    await view.rerender({
      state: { ...state, output: { ...primary } },
      attachments: [{ ...second, url: 'https://example.com/renewed.webp' }],
      now: 5000
    })
    expect(screen.getByRole('img', { name: 'Output' })).toHaveAttribute(
      'src',
      'https://example.com/renewed.webp'
    )
    await user.click(screen.getByRole('button', { name: 'Image 1' }))
    expect(screen.getByTestId('run-expired')).toHaveTextContent(
      'This output has expired.'
    )
    await user.click(screen.getByRole('button', { name: 'Image 2' }))
    expect(screen.queryByTestId('run-expired')).toBeNull()
  })

  it('shows the supplied run phase before generation begins', () => {
    render(PlaygroundOutput, {
      props: {
        modelName: 'Workflow',
        now: 3000,
        state: { status: 'running', startedAt: 1000, label: 'Queued' }
      }
    })
    expect(screen.getByRole('status')).toHaveTextContent('Queued')
    expect(screen.queryByText('Generating…')).toBeNull()
  })
  it.for([
    { event: 'playing', status: 'succeeded' },
    { event: 'pause', status: 'cancelled' }
  ])(
    'observes audio playback $event without loadeddata',
    async ({ event, status }) => {
      const media: RunOutput = {
        kind: 'audio',
        url: 'https://assets.example/audio',
        fileName: 'audio.wav'
      }
      const view = render(PlaygroundOutput, {
        props: { modelName: 'Demo', state: succeeded(media), now: 2000 }
      })
      const element = screen.getByLabelText('Output', { selector: 'audio' })
      await fireEvent(element, new Event('loadstart'))
      await fireEvent(element, new Event('loadedmetadata'))
      expect(view.emitted().playbackStarted).toBeUndefined()
      await fireEvent.play(element)
      expect(view.emitted().playbackStarted).toEqual([[media.url]])
      await fireEvent(element, new Event(event))
      expect(view.emitted().delivery).toEqual([[media.url, status]])
    }
  )

  it.for(['video', 'audio'] as const)(
    'reports decoded %s data instead of metadata alone',
    async (kind) => {
      const media = {
        kind,
        url: 'https://assets.example/result',
        fileName: 'result'
      }
      const view = render(PlaygroundOutput, {
        props: { modelName: 'Demo', state: succeeded(media), now: 2000 }
      })
      const element = screen.getByLabelText('Output', { selector: kind })
      await fireEvent(element, new Event('loadedmetadata'))
      expect(view.emitted().delivery).toBeUndefined()
      await fireEvent(element, new Event('loadeddata'))
      expect(view.emitted().delivery).toEqual([[media.url, 'succeeded']])
    }
  )

  it.for([
    {
      name: 'an earlier run',
      latest: output('latest'),
      leave: 'earlier-run-0'
    },
    {
      name: 'another file of the run',
      latest: output('latest'),
      leave: 'Raw response'
    },
    {
      name: 'another item of the batch',
      latest: {
        ...output('latest'),
        urls: [output('latest').url, output('second').url]
      },
      leave: 'output-thumb-1'
    }
  ])(
    'reports the primary output abandoned when the visitor opens $name',
    async ({ latest, leave }) => {
      const user = userEvent.setup()
      const view = render(PlaygroundOutput, {
        props: {
          modelName: 'Demo',
          state: succeeded(latest),
          earlier: [{ output: output('first'), attachments: [] }],
          attachments: [
            {
              kind: 'text',
              url: 'https://example.com/response.json',
              fileName: 'response.json'
            }
          ],
          now: 2_000
        }
      })
      expect(view.emitted().delivery).toBeUndefined()

      await user.click(
        screen.queryByTestId(leave) ??
          screen.getByRole('button', { name: leave })
      )
      expect(view.emitted().delivery).toEqual([
        [output('latest').url, 'cancelled']
      ])
    }
  )

  it('contains focus in the expanded image and restores it on Escape', async () => {
    const user = userEvent.setup()
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(output('latest')),
        now: 2_000
      }
    })
    const trigger = screen.getByRole('button', { name: 'Expand' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Output' })
    const close = within(dialog).getByRole('button', { name: 'Close' })
    await waitFor(() => expect(close).toHaveFocus())
    await user.tab()
    expect(close).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('leaves video fullscreen to the shared video player', () => {
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded({
          kind: 'video',
          url: 'https://example.com/run.mp4',
          fileName: 'run.mp4'
        }),
        modality: 'video',
        now: 2_000
      }
    })

    expect(screen.queryByTestId('output-expand')).toBeNull()
    expect(
      screen.getByLabelText('Output', { selector: 'video' })
    ).toHaveAttribute('src', 'https://example.com/run.mp4')
  })

  it('announces expiration when a completed output is no longer available', async () => {
    const { rerender } = render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(output('latest')),
        now: 2_000
      }
    })
    expect(screen.getByRole('status').textContent).toBe('Generation complete.')
    await rerender({ now: 100_000 })
    expect(screen.getByRole('status').textContent).toBe(
      'This output has expired.'
    )
  })

  it('asks users to review their inputs after a content-policy rejection', () => {
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedance 2.5',
        state: { status: 'failed', reason: 'policy', fieldErrors: {} },
        now: 0
      }
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      'The model provider blocked the input or generated output under its content policy. Review your prompt and reference files before running again.'
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it.for([
    { locale: 'en' as const, label: 'Add credits' },
    { locale: 'zh-CN' as const, label: '添加积分' }
  ])(
    'opens the shared credits dialog after an insufficient-credit failure in $locale',
    async ({ locale, label }) => {
      const user = userEvent.setup()
      const view = render(PlaygroundOutput, {
        props: {
          modelName: 'Seedream 4.5',
          state: { status: 'failed', reason: 'noCredits', fieldErrors: {} },
          now: 0,
          locale
        }
      })
      await user.click(screen.getByRole('button', { name: label }))
      expect(view.emitted().buyCredits).toHaveLength(1)
    }
  )

  it('uses a real video element for typed video outputs without filename extensions', () => {
    const video: RunOutput = {
      kind: 'video',
      url: 'https://assets.example/signed/456',
      fileName: 'result.mp4'
    }
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(video),
        now: 2_000
      }
    })
    expect(
      screen.getByLabelText('Output', { selector: 'video' }).getAttribute('src')
    ).toBe(video.url)
    expect(screen.queryByRole('img')).toBeNull()
  })
  it('plays audio from its actual URL even without a filename extension', () => {
    const audio: RunOutput = {
      kind: 'audio',
      url: 'https://assets.example/signed/123',
      fileName: 'result.mp3'
    }
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(audio),
        now: 2_000
      }
    })
    expect(screen.getByTestId('output-audio').getAttribute('src')).toBe(
      audio.url
    )
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('displays escaped text and offers unknown or 3D results as downloads', async () => {
    const text: RunOutput = {
      kind: 'text',
      url: 'blob:reply',
      text: '<script>unsafe()</script>',
      fileName: 'reply.json'
    }
    const model: RunOutput = {
      kind: '3d',
      url: 'https://assets.example/model.glb',
      fileName: 'model.glb'
    }
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(text),
        earlier: [{ output: model, attachments: [] }],
        now: 2_000
      }
    })
    expect(screen.getByText('<script>unsafe()</script>')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    await userEvent.setup().click(screen.getByTestId('earlier-run-0'))
    expect(screen.getByText('model.glb')).toBeTruthy()
    expect(screen.getByTestId('output-download').getAttribute('href')).toBe(
      model.url
    )
    expect(screen.queryByRole('img')).toBeNull()
  })
  it('renders the shipped example with a hint instead of run actions', () => {
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: { status: 'example', output: output('example') },
        now: 0
      }
    })
    expect(screen.getByTestId('output-example')).toBeTruthy()
    expect(screen.getByTestId('output-example-hint').textContent).toContain(
      'Run Seedream 4.5 to make your own.'
    )
    expect(screen.queryByTestId('output-download')).toBeNull()
    expect(screen.getByRole('img').getAttribute('src')).toContain('example')
  })

  it('shows the latest run and switches to an earlier one on demand', async () => {
    const user = userEvent.setup()
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(output('latest')),
        earlier: [{ output: output('first'), attachments: [] }],
        now: 2_000
      }
    })
    expect(
      screen.getByTestId('output-download').getAttribute('href')
    ).toContain('latest')

    await user.click(screen.getByTestId('earlier-run-0'))
    expect(
      screen.getByTestId('output-download').getAttribute('href')
    ).toContain('first')
    await user.click(screen.getByTestId('earlier-latest'))
    expect(
      screen.getByTestId('output-download').getAttribute('href')
    ).toContain('latest')
  })

  it('switches between the files of one run from the output header', async () => {
    const user = userEvent.setup()
    const response: RunOutput = {
      kind: 'text',
      url: 'https://example.com/response.json',
      fileName: 'response.json'
    }
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(output('latest')),
        attachments: [response],
        now: 2_000
      }
    })

    const header = within(screen.getByRole('group', { name: 'Output files' }))
    expect(
      header.getByRole('button', { name: 'Image', pressed: true })
    ).toBeTruthy()

    await user.click(header.getByRole('button', { name: 'Raw response' }))
    expect(
      screen.getByTestId('output-download').getAttribute('href')
    ).toContain('response')
    expect(
      header.getByRole('button', { name: 'Raw response', pressed: true })
    ).toBeTruthy()
  })

  it('gives every file of a wide run its own button', () => {
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(output('latest')),
        attachments: Array.from({ length: 10 }, (_, index) => ({
          kind: 'image' as const,
          url: `https://example.com/extra-${index}.webp`,
          fileName: `extra-${index}.webp`
        })),
        now: 2_000
      }
    })
    expect(
      within(screen.getByRole('group', { name: 'Output files' })).getAllByRole(
        'button'
      )
    ).toHaveLength(11)
  })

  it('withholds the file switch while the result is blurred', () => {
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(output('latest'), true),
        attachments: [
          {
            kind: 'text',
            url: 'https://example.com/response.json',
            fileName: 'response.json'
          }
        ],
        now: 2_000
      }
    })
    expect(screen.queryByRole('button', { name: 'Raw response' })).toBeNull()
  })

  it('lines the session up in the order it was generated, newest last', async () => {
    const user = userEvent.setup()
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(output('third')),
        earlier: [
          { output: output('second'), attachments: [] },
          { output: output('first'), attachments: [] }
        ],
        now: 2_000
      }
    })
    const strip = within(screen.getByTestId('earlier-runs'))
    expect(
      strip
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Earlier run 1', 'Earlier run 2', 'Latest'])
    expect(
      strip.getByRole('button', { name: 'Latest', pressed: true })
    ).toBeTruthy()
    await user.click(strip.getByRole('button', { name: 'Earlier run 1' }))
    expect(
      screen.getByTestId('output-download').getAttribute('href')
    ).toContain('first')
  })

  it('downloads the selected batch item and the selected earlier run', async () => {
    const user = userEvent.setup()
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded({
          ...output('latest'),
          urls: ['https://example.com/a.webp', 'https://example.com/b.webp']
        }),
        earlier: [{ output: output('first'), attachments: [] }],
        now: 2_000
      }
    })
    await user.click(screen.getByTestId('output-thumb-1'))
    await user.click(screen.getByTestId('output-download'))
    expect(downloadOutput).toHaveBeenLastCalledWith(
      'https://example.com/b.webp',
      'latest.webp',
      { onUnavailable: undefined }
    )
    await user.click(screen.getByTestId('earlier-run-0'))
    await user.click(screen.getByTestId('output-download'))
    expect(downloadOutput).toHaveBeenLastCalledWith(
      'https://example.com/first.webp',
      'first.webp',
      { onUnavailable: undefined }
    )
  })

  it.for([
    {
      locale: 'en' as const,
      label: 'Open output',
      hint: 'If your download did not start, open the output to save a copy.'
    },
    {
      locale: 'zh-CN' as const,
      label: '打开输出',
      hint: '如果下载未开始，请打开输出文件并保存副本。'
    }
  ])(
    'offers a native fallback link after download failure in $locale',
    async ({ locale, label, hint }) => {
      const user = userEvent.setup()
      vi.mocked(downloadOutput).mockResolvedValueOnce(false)
      render(PlaygroundOutput, {
        props: {
          modelName: 'Seedream 4.5',
          state: succeeded(output('latest')),
          now: 2_000,
          locale
        }
      })
      await user.click(screen.getByTestId('output-download'))
      const fallback = await screen.findByRole('link', { name: label })
      expect(fallback).toHaveAttribute('href', output('latest').url)
      expect(fallback).toHaveAttribute('target', '_blank')
      expect(fallback).toHaveAttribute('rel', 'noopener')
      expect(fallback).not.toHaveAttribute('download')
      expect(screen.getByText(hint)).toHaveAttribute('role', 'status')
      let prevented: boolean | undefined
      fallback.addEventListener('click', (event) => {
        prevented = event.defaultPrevented
        event.preventDefault()
      })
      await user.click(fallback)
      expect(prevented).toBe(false)
      expect(downloadOutput).toHaveBeenCalledOnce()
    }
  )

  it('does not apply a previous output download failure to the current output', async () => {
    const result = Promise.withResolvers<boolean>()
    vi.mocked(downloadOutput).mockReturnValueOnce(result.promise)
    const { rerender } = render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(output('first')),
        now: 2_000
      }
    })
    await userEvent.setup().click(screen.getByTestId('output-download'))
    await rerender({ state: succeeded(output('latest')) })
    result.resolve(false)
    await result.promise
    await nextTick()
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      output('latest').url
    )
    expect(screen.queryByRole('link', { name: 'Open output' })).toBeNull()
  })

  it('starts an earlier run at its own first output', async () => {
    const user = userEvent.setup()
    const batch = {
      ...output('latest'),
      urls: ['https://example.com/a.webp', 'https://example.com/b.webp']
    }
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(batch),
        earlier: [{ output: output('first'), attachments: [] }],
        now: 2_000
      }
    })

    await user.click(screen.getByTestId('output-thumb-1'))
    await user.click(screen.getByTestId('earlier-run-0'))

    expect(
      screen.getByTestId('output-download').getAttribute('href')
    ).toContain('first')
  })

  it('pages through a batch and keeps sensitive results behind a reveal', async () => {
    const user = userEvent.setup()
    const batch = {
      ...output('a'),
      urls: ['https://example.com/a.webp', 'https://example.com/b.webp']
    }
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(batch, true),
        now: 2_000
      }
    })
    expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull()
    expect(
      screen.queryByRole('img', { name: 'Output' })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('output-download')).not.toBeInTheDocument()
    const reveal = screen.getByRole('button', { name: /Show anyway/ })
    expect(reveal).toBeTruthy()
    await user.click(reveal)
    expect(screen.getByRole('img', { name: 'Output' })).toBeVisible()
    expect(screen.getByTestId('output-download')).toBeVisible()
    await user.click(screen.getByTestId('output-thumb-1'))
    expect(
      screen.getByTestId('output-download').getAttribute('href')
    ).toContain('b.webp')
  })

  it('blurs the latest run in the strip when the run, not its output, is rated sensitive', () => {
    render(PlaygroundOutput, {
      props: {
        modelName: 'Seedream 4.5',
        state: succeeded(output('latest'), true),
        earlier: [{ output: output('first'), attachments: [] }],
        now: 2_000
      }
    })
    const thumbnail = (testId: string) =>
      within(screen.getByTestId(testId)).getByRole('img')
    expect(thumbnail('earlier-latest')).toHaveClass('blur-md')
    expect(thumbnail('earlier-run-0')).not.toHaveClass('blur-md')
  })
})
