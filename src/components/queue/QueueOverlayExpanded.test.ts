import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { computed, defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { JobListItem } from '@/composables/queue/useJobList'

vi.mock<unknown>(import('@/composables/queue/useJobMenu'), () => ({
  useJobMenu: () => ({
    jobMenuEntries: computed(() => [{ label: 'Inspect' }])
  })
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
  JobAssetsList: JobAssetsListStub
}

const global = {
  stubs,
  plugins: [
    createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: { contextMenu: { new: 'New' } } }
    })
  ]
}

describe('QueueOverlayExpanded', () => {
  it('renders JobAssetsList', () => {
    const { container } = render(QueueOverlayExpanded, {
      props: defaultProps,
      global
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
      global
    })

    await user.click(screen.getByTestId('stub-cancel'))
    await user.click(screen.getByTestId('stub-delete'))
    await user.click(screen.getByTestId('stub-view'))

    expect(onCancelItem).toHaveBeenCalledWith(testJob)
    expect(onDeleteItem).toHaveBeenCalledWith(testJob)
    expect(onViewItem).toHaveBeenCalledWith(testJob)
  })

  it('toggles the same clicked job and reopens for another job or right click', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    render(QueueOverlayExpanded, {
      props: defaultProps,
      global
    })
    const menuClosed = () =>
      waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())

    await user.click(screen.getByTestId('stub-menu-first'))
    expect(
      await screen.findByRole('menuitem', { name: 'Inspect' })
    ).toBeVisible()

    await user.click(screen.getByTestId('stub-menu-first'))
    await menuClosed()

    await user.click(screen.getByTestId('stub-menu-second'))
    expect(await screen.findByRole('menu')).toBeVisible()

    await fireEvent.contextMenu(screen.getByTestId('stub-menu-context'))
    expect(await screen.findByRole('menu')).toBeVisible()
  })
})
