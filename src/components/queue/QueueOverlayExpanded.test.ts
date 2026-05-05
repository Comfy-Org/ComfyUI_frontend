import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { JobListItem } from '@/composables/queue/useJobList'

vi.mock('@/composables/queue/useJobMenu', () => ({
  useJobMenu: () => ({ jobMenuEntries: [] })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandlingAsync: <T extends (...args: never[]) => unknown>(
      fn: T
    ) => fn
  })
}))

import QueueOverlayExpanded from '@/components/queue/QueueOverlayExpanded.vue'

const QueueOverlayHeaderStub = {
  template: '<div />'
}

const JobFiltersBarStub = {
  template: '<div />'
}

const testJob: JobListItem = {
  id: 'job-1',
  title: 'Job 1',
  meta: 'meta',
  state: 'pending'
}

const JobAssetsListStub = defineComponent({
  name: 'JobAssetsList',
  setup(_, { emit }) {
    return {
      triggerCancel: () => emit('cancel-item', testJob),
      triggerDelete: () => emit('delete-item', testJob),
      triggerView: () => emit('view-item', testJob)
    }
  },
  template: `
    <div class="job-assets-list-stub">
      <button data-testid="stub-cancel" @click="triggerCancel()" />
      <button data-testid="stub-delete" @click="triggerDelete()" />
      <button data-testid="stub-view" @click="triggerView()" />
    </div>
  `
})

const JobContextMenuStub = {
  template: '<div />'
}

const defaultProps = {
  headerTitle: 'Jobs',
  queuedCount: 1,
  selectedJobTab: 'All' as const,
  selectedWorkflowFilter: 'all' as const,
  selectedSortMode: 'mostRecent' as const,
  displayedJobGroups: [],
  hasFailedJobs: false
}

const stubs = {
  QueueOverlayHeader: QueueOverlayHeaderStub,
  JobFiltersBar: JobFiltersBarStub,
  JobAssetsList: JobAssetsListStub,
  JobContextMenu: JobContextMenuStub
}

describe('QueueOverlayExpanded', () => {
  it('renders JobAssetsList', () => {
    const { container } = render(QueueOverlayExpanded, {
      props: defaultProps,
      global: { stubs }
    })
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('.job-assets-list-stub')).toBeTruthy()
  })

  it('re-emits list item actions from JobAssetsList', async () => {
    const user = userEvent.setup()
    const onCancelItem = vi.fn<(item: JobListItem) => void>()
    const onDeleteItem = vi.fn<(item: JobListItem) => void>()
    const onViewItem = vi.fn<(item: JobListItem) => void>()

    render(QueueOverlayExpanded, {
      props: { ...defaultProps, onCancelItem, onDeleteItem, onViewItem },
      global: { stubs }
    })

    await user.click(screen.getByTestId('stub-cancel'))
    await user.click(screen.getByTestId('stub-delete'))
    await user.click(screen.getByTestId('stub-view'))

    expect(onCancelItem).toHaveBeenCalledWith(testJob)
    expect(onDeleteItem).toHaveBeenCalledWith(testJob)
    expect(onViewItem).toHaveBeenCalledWith(testJob)
  })
})
