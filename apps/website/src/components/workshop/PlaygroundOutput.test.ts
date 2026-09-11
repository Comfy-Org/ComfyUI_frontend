// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { RunOutput, RunState } from '../../config/workshop-run'
import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import PlaygroundOutput from './PlaygroundOutput.vue'

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
  it.for([
    { locale: 'en' as const, label: 'Buy credits' },
    { locale: 'zh-CN' as const, label: '购买积分' }
  ])(
    'takes an insufficient-credit failure to billing in $locale',
    ({ locale, label }) => {
      render(PlaygroundOutput, {
        props: {
          state: { status: 'failed', reason: 'noCredits', fieldErrors: {} },
          now: 0,
          locale
        }
      })
      const link = screen.getByRole('link', { name: label })
      expect(link.getAttribute('href')).toBe(
        `${WORKSHOP_CLOUD_BASE_URL}/?settings=plan-credits`
      )
      expect(link.getAttribute('target')).toBe('_blank')
      expect(screen.queryByRole('button')).toBeNull()
    }
  )

  it('uses a real video element for typed video outputs without filename extensions', () => {
    const video: RunOutput = {
      kind: 'video',
      url: 'https://assets.example/signed/456',
      fileName: 'result.mp4'
    }
    render(PlaygroundOutput, { props: { state: succeeded(video), now: 2_000 } })
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
    render(PlaygroundOutput, { props: { state: succeeded(audio), now: 2_000 } })
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
      props: { state: { status: 'example', output: output('example') }, now: 0 }
    })
    expect(screen.getByTestId('output-example')).toBeTruthy()
    expect(screen.getByTestId('output-example-hint')).toBeTruthy()
    expect(screen.queryByTestId('output-download')).toBeNull()
    expect(screen.getByRole('img').getAttribute('src')).toContain('example')
  })

  it('shows the latest run and switches to an earlier one on demand', async () => {
    const user = userEvent.setup()
    render(PlaygroundOutput, {
      props: {
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

  it('starts an earlier run at its own first output', async () => {
    const user = userEvent.setup()
    const batch = {
      ...output('latest'),
      urls: ['https://example.com/a.webp', 'https://example.com/b.webp']
    }
    render(PlaygroundOutput, {
      props: {
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
      props: { state: succeeded(batch, true), now: 2_000 }
    })
    await user.click(screen.getByTestId('output-reveal'))
    await user.click(screen.getByTestId('output-thumb-1'))
    expect(
      screen.getByTestId('output-download').getAttribute('href')
    ).toContain('b.webp')
  })
})
