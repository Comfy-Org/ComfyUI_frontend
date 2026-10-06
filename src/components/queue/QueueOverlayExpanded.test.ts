import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { JobListItem } from '@/composables/queue/useJobList'

vi.mock<unknown>(import('@/composables/queue/useJobMenu'), () => ({
  useJobMenu: () => ({ jobMenuEntries: { value: [] } })
}))

vi.mock(import('@/composables/useErrorHandling'))

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
const secondJob = { ...testJob, id: 'job-2', title: 'Job 2' }

const JobAssetsListStub = defineComponent({
  name: 'JobAssetsList',
  setup(_, { emit }) {
    return {
      testJob,
      secondJob,
      triggerCancel: () => emit('cancel-item', testJob),
      triggerDelete: () => emit('delete-item', testJob),
      triggerView: () => emit('view-item', testJob),
      triggerMenu: (item: JobListItem, event: Event) =>
        emit('menu', item, event)
    }
  },
  template: `
    <div class="job-assets-list-stub">
      <button data-testid="stub-cancel" @click="triggerCancel()" />
      <button data-testid="stub-delete" @click="triggerDelete()" />
      <button data-testid="stub-view" @click="triggerView()" />
      <button data-testid="stub-menu-first" @click="triggerMenu(testJob, $event)" />
      <button data-testid="stub-menu-second" @click="triggerMenu(secondJob, $event)" />
      <button data-testid="stub-menu-context" @contextmenu="triggerMenu(testJob, $event)" />
    </div>
  `
})

const showMenuMock = vi.fn()
const toggleMenuMock = vi.fn()

const ContextMenuStub = defineComponent({
  methods: {
    show: showMenuMock,
    toggle: toggleMenuMock
  },
  template: '<div />'
})

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
  ContextMenu: ContextMenuStub
}

describe('QueueOverlayExpanded', () => {
  beforeEach(() => {
    showMenuMock.mockClear()
    toggleMenuMock.mockClear()
  })

  it('renders JobAssetsList', () => {
    const { container } = render(QueueOverlayExpanded, {
      props: defaultProps,
      global: { stubs }
    })
    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
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

  it('toggles the same clicked job and repositions for another job or right click', async () => {
    const user = userEvent.setup()
    render(QueueOverlayExpanded, {
      props: defaultProps,
      global: { stubs }
    })

    await user.click(screen.getByTestId('stub-menu-first'))
    await user.click(screen.getByTestId('stub-menu-first'))
    await user.click(screen.getByTestId('stub-menu-second'))
    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByTestId('stub-menu-context')
    })

    expect(toggleMenuMock).toHaveBeenCalledOnce()
    expect(showMenuMock).toHaveBeenCalledTimes(3)
  })
})
