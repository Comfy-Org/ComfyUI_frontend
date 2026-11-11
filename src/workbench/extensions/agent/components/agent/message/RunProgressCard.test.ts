import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import RunProgressCard from './RunProgressCard.vue'

type View = 'starting' | 'running' | 'notStarted' | 'ran' | 'requested'

function renderCard(view: View, durationMs?: number) {
  render(RunProgressCard, {
    props: { view, durationMs },
    global: { plugins: [i18n] }
  })
  return screen.getByRole('group', { name: 'Workflow run' })
}

describe('RunProgressCard', () => {
  it.for<[View, string]>([
    ['starting', 'Starting the run'],
    ['running', 'Running the workflow'],
    ['notStarted', 'The run did not start'],
    ['ran', 'Ran the workflow'],
    ['requested', 'The agent asked to run the workflow']
  ])('names the %s view in the workflow run group', ([view, text]) => {
    const card = renderCard(view)

    expect(within(card).getByText(text)).toBeInTheDocument()
  })

  it.for<[View, boolean]>([
    ['starting', true],
    ['running', true],
    ['notStarted', false],
    ['ran', false],
    ['requested', false]
  ])(
    'shows a progress bar for %s only while the run is live',
    ([view, live]) => {
      const card = renderCard(view)

      expect(within(card).queryAllByRole('progressbar')).toHaveLength(
        live ? 1 : 0
      )
    }
  )

  it('leaves the progress bar without a value, as indeterminate', () => {
    const bar = within(renderCard('running')).getByRole('progressbar')

    expect(bar).not.toHaveAttribute('aria-valuenow')
    expect(bar).toHaveAccessibleName('Running the workflow')
  })

  it.for<[View, boolean]>([
    ['starting', false],
    ['running', true],
    ['ran', false]
  ])(
    'says live progress is unavailable for %s only while running',
    ([view, shown]) => {
      const card = renderCard(view)

      expect(
        within(card).queryAllByText(
          'Live progress is not available for this run'
        )
      ).toHaveLength(shown ? 1 : 0)
    }
  )

  it.for<[string, number | undefined, string]>([
    ['no duration', undefined, 'Ran the workflow'],
    ['a duration that rounds to nothing', 400, 'Ran the workflow'],
    ['under a minute', 42_300, 'Ran the workflow in 42s'],
    ['just under a minute', 59_400, 'Ran the workflow in 59s'],
    ['exactly a minute', 60_000, 'Ran the workflow in 1m 0s'],
    ['over a minute', 72_000, 'Ran the workflow in 1m 12s']
  ])('words a finished run with %s', ([, durationMs, text]) => {
    const card = renderCard('ran', durationMs)

    expect(card.textContent.trim()).toBe(text)
  })

  it('keeps the duration out of a view that is not a finished run', () => {
    const card = renderCard('requested', 42_000)

    expect(card.textContent.trim()).toBe('The agent asked to run the workflow')
  })
})
