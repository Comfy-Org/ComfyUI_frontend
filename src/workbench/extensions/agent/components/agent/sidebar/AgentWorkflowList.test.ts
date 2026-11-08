import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'

import AgentWorkflowList from './AgentWorkflowList.vue'
import type { WorkflowListItem } from './workflowListItem'

const items: WorkflowListItem[] = [
  { path: 'workflows/Fox portrait.json', name: 'Fox portrait' },
  {
    path: 'workflows/video/Seedance clip.json',
    name: 'Seedance clip',
    folder: 'video'
  },
  {
    path: 'workflows/video/drafts/Fox trot.json',
    name: 'Fox trot',
    folder: 'video/drafts'
  }
]

function numbered(count: number): WorkflowListItem[] {
  return Array.from({ length: count }, (_, index) => ({
    path: `workflows/Batch ${index + 1}.json`,
    name: `Batch ${index + 1}`
  }))
}

function mount(props: Partial<ComponentProps<typeof AgentWorkflowList>> = {}) {
  return render(AgentWorkflowList, {
    props: { kind: 'workflows', items, ...props },
    global: { plugins: [i18n], directives: { tooltip: {} } }
  })
}

function rowNames(): (string | null)[] {
  return within(screen.getByRole('list'))
    .getAllByRole('button')
    .map((row) => row.getAttribute('aria-label'))
}

describe('AgentWorkflowList', () => {
  it('lists each workflow with its folder underneath', () => {
    mount()

    expect(rowNames()).toEqual(['Fox portrait', 'Seedance clip', 'Fox trot'])
    expect(
      screen.getByRole('button', { name: 'Seedance clip' })
    ).toHaveAccessibleDescription('video')
    expect(
      screen.getByRole('button', { name: 'Fox trot' })
    ).toHaveAccessibleDescription('video/drafts')
    expect(screen.getByText('video/drafts')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Fox portrait' })
    ).not.toHaveAccessibleDescription()
  })

  it('filters by name whatever the letter case', async () => {
    mount()

    await userEvent.type(screen.getByPlaceholderText('Search workflows'), 'fOX')

    expect(rowNames()).toEqual(['Fox portrait', 'Fox trot'])
  })

  it('says what was searched for when nothing matches', async () => {
    mount()

    await userEvent.type(
      screen.getByPlaceholderText('Search workflows'),
      'upscale'
    )

    expect(screen.getByText('Nothing matches "upscale"')).toBeVisible()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it.for([
    { kind: 'apps', placeholder: 'Search apps', empty: 'No apps yet' },
    {
      kind: 'workflows',
      placeholder: 'Search workflows',
      empty: 'No workflows yet'
    }
  ] as const)(
    'tells a user with no $kind that there are none yet',
    ({ kind, placeholder, empty }) => {
      mount({ kind, items: [] })

      expect(screen.getByPlaceholderText(placeholder)).toBeVisible()
      expect(screen.getByText(empty)).toBeVisible()
    }
  )

  it('waits for the first load instead of claiming there is nothing', () => {
    mount({ items: [], loading: true })

    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(screen.queryByText('No workflows yet')).toBeNull()
  })

  it('asks for a refresh', async () => {
    const view = mount()
    const refresh = screen.getByRole('button', { name: 'Refresh' })
    expect(refresh).toHaveAttribute('aria-busy', 'false')

    await userEvent.click(refresh)

    expect(view.emitted().refresh).toHaveLength(1)
  })

  it('shows the refresh as busy while the list is loading', async () => {
    const view = mount({ loading: true })
    const refresh = screen.getByRole('button', { name: 'Refresh' })

    await userEvent.click(refresh)

    expect(refresh).toHaveAttribute('aria-busy', 'true')
    expect(view.emitted().refresh).toBeUndefined()
  })

  it('asks to open the workflow that was picked', async () => {
    const view = mount()

    await userEvent.click(screen.getByRole('button', { name: 'Seedance clip' }))

    expect(view.emitted().open).toEqual([
      ['workflows/video/Seedance clip.json']
    ])
  })

  it('marks the workflow that is opening and ignores a second click on it', async () => {
    const view = mount({ openingPath: 'workflows/Fox portrait.json' })
    const opening = screen.getByRole('button', { name: 'Fox portrait' })

    await userEvent.click(opening)

    expect(opening).toHaveAttribute('aria-busy', 'true')
    expect(
      screen.getByRole('button', { name: 'Seedance clip' })
    ).toHaveAttribute('aria-busy', 'false')
    expect(view.emitted().open).toBeUndefined()
  })

  it('explains a workflow that could not open and lets it be retried', async () => {
    const view = mount({ failedPath: 'workflows/video/Seedance clip.json' })
    const failed = screen.getByRole('button', { name: 'Seedance clip' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't open Seedance clip. Try again."
    )
    expect(failed).toHaveAccessibleDescription(
      "video Couldn't open Seedance clip. Try again."
    )

    await userEvent.click(failed)

    expect(view.emitted().open).toEqual([
      ['workflows/video/Seedance clip.json']
    ])
  })

  it('shows the first 50 and reveals the rest on Show more', async () => {
    mount({ items: numbered(52) })
    expect(screen.getAllByRole('listitem')).toHaveLength(50)
    expect(screen.queryByRole('button', { name: 'Batch 51' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))

    expect(screen.getAllByRole('listitem')).toHaveLength(52)
    expect(screen.getByRole('button', { name: 'Batch 52' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
  })

  it('offers no Show more for a list that already fits', () => {
    mount({ items: numbered(50) })

    expect(screen.getAllByRole('listitem')).toHaveLength(50)
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
  })
})
