import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import QueueProgressOverlay from '@/components/queue/QueueProgressOverlay.vue'
import { i18n } from '@/i18n'
import type { JobStatus } from '@/platform/remote/comfyui/jobs/jobTypes'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

const QueueOverlayExpandedStub = defineComponent({
  name: 'QueueOverlayExpanded',
  props: {
    headerTitle: {
      type: String,
      required: true
    }
  },
  template: `
    <div>
      <div data-testid="expanded-title">{{ headerTitle }}</div>
      <button data-testid="show-assets-button" @click="$emit('show-assets')" />
    </div>
  `
})

function createTask(id: string, status: JobStatus): TaskItemImpl {
  return new TaskItemImpl({
    id,
    status,
    create_time: 0,
    priority: 0
  })
}

function renderComponent(
  runningTasks: TaskItemImpl[],
  pendingTasks: TaskItemImpl[]
) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false
  })
  const queueStore = useQueueStore(pinia)
  const sidebarTabStore = useSidebarTabStore(pinia)
  queueStore.runningTasks = runningTasks
  queueStore.pendingTasks = pendingTasks

  const user = userEvent.setup()

  render(QueueProgressOverlay, {
    props: {
      expanded: true
    },
    global: {
      plugins: [pinia, i18n],
      stubs: {
        QueueOverlayExpanded: QueueOverlayExpandedStub,
        QueueOverlayActive: true,
        MediaLightbox: true
      },
      directives: {
        tooltip: () => {}
      }
    }
  })

  return { sidebarTabStore, user }
}

describe('QueueProgressOverlay', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('shows expanded header with running and queued labels', () => {
    renderComponent(
      [
        createTask('running-1', 'in_progress'),
        createTask('running-2', 'in_progress')
      ],
      [createTask('pending-1', 'pending')]
    )

    expect(screen.getByTestId('expanded-title')).toHaveTextContent(
      '2 running, 1 queued'
    )
  })

  it('shows only running label when queued count is zero', () => {
    renderComponent([createTask('running-1', 'in_progress')], [])

    expect(screen.getByTestId('expanded-title')).toHaveTextContent('1 running')
  })

  it('shows job queue title when there are no active jobs', () => {
    renderComponent([], [])

    expect(screen.getByTestId('expanded-title')).toHaveTextContent('Job Queue')
  })

  it('toggles the assets sidebar tab when show-assets is clicked', async () => {
    const { sidebarTabStore, user } = renderComponent([], [])

    expect(sidebarTabStore.activeSidebarTabId).toBe(null)

    await user.click(screen.getByTestId('show-assets-button'))
    expect(sidebarTabStore.activeSidebarTabId).toBe('assets')

    await user.click(screen.getByTestId('show-assets-button'))
    expect(sidebarTabStore.activeSidebarTabId).toBe(null)
  })
})
