// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { RunOutput, RunState } from '../../config/workshop-run'
import PlaygroundOutput from './PlaygroundOutput.vue'

const output = (name: string): RunOutput => ({
  kind: 'image',
  url: `https://example.com/${name}.webp`,
  fileName: `${name}.webp`
})

const succeeded = (out: RunOutput, nsfw = false): RunState => ({
  status: 'succeeded',
  output: out,
  creditsUsed: 8,
  completedAt: 1_000,
  expiresAt: 100_000,
  nsfw
})

describe('PlaygroundOutput', () => {
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
        earlier: [output('first')],
        now: 2_000
      }
    })
    expect(screen.getByTestId('run-credits-used').textContent).toContain('8')
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
