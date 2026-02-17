import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'

import QueueProgressOverlay from '@/components/queue/QueueProgressOverlay.vue'
import type { JobStatus } from '@/platform/remote/comfyui/jobs/jobTypes'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'

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
  template: '<div data-testid="expanded-title">{{ headerTitle }}</div>'
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        emDash: '-',
        untitled: 'Untitled',
        disconnectedFromBackend: 'Disconnected',
        unknownError: 'Unknown error',
        error: 'Error'
      },
      queue: {
        jobList: {
          undated: 'Undated'
        }
      },
      sideToolbar: {
        queueProgressOverlay: {
          runningJobsLabel: '{count} running',
          queuedJobsLabel: '{count} queued',
          runningQueuedSummary: '{running}, {queued}',
          jobQueue: 'Job queue'
        }
      }
    }
  }
})

function createTask(id: string, status: JobStatus): TaskItemImpl {
  return new TaskItemImpl({
    id,
    status,
    create_time: 0,
    priority: 0
  })
}

const mountComponent = (
  runningTasks: TaskItemImpl[],
  pendingTasks: TaskItemImpl[]
) => {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false
  })
  const queueStore = useQueueStore(pinia)
  queueStore.runningTasks = runningTasks
  queueStore.pendingTasks = pendingTasks

  return mount(QueueProgressOverlay, {
    props: {
      expanded: true
    },
    global: {
      plugins: [pinia, i18n],
      stubs: {
        QueueOverlayExpanded: QueueOverlayExpandedStub,
        QueueOverlayActive: true,
        ResultGallery: true
      },
      directives: {
        tooltip: () => {}
      }
    }
  })
}

describe('QueueProgressOverlay', () => {
  it('shows expanded header with running and queued labels', () => {
    const wrapper = mountComponent(
      [
        createTask('running-1', 'in_progress'),
        createTask('running-2', 'in_progress')
      ],
      [createTask('pending-1', 'pending')]
    )

    expect(wrapper.get('[data-testid="expanded-title"]').text()).toBe(
      '2 running, 1 queued'
    )
  })

  it('shows job queue title when there are no active jobs', () => {
    const wrapper = mountComponent([], [])

    expect(wrapper.get('[data-testid="expanded-title"]').text()).toBe(
      'Job queue'
    )
  })
})
