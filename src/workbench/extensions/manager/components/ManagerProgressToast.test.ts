import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, onMounted } from 'vue'

import type { UseScrollReturn } from '@vueuse/core'

const mockFailedTasksIds = vi.hoisted(() => ({ value: [] as string[] }))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: vi.fn(
      (key: string, params?: Record<string, unknown>, count?: number) => {
        if (count !== undefined) return `${key}:${count}`
        if (params && 'count' in params) return `${key}:${params.count}`
        return key
      }
    )
  }),
  createI18n: vi.fn(() => ({
    global: { t: vi.fn((key: string) => key) }
  }))
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    useScroll: () => ({ y: { value: 0 } }) as UseScrollReturn,
    whenever: vi.fn()
  }
})

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: () => ({
    taskLogs: [{ taskId: '1', taskName: 'Test', logs: ['log'] }],
    get failedTasksIds() {
      return mockFailedTasksIds.value
    },
    succeededTasksIds: [],
    succeededTasksLogs: [],
    failedTasksLogs: [],
    taskHistory: {},
    taskQueue: {
      history: {},
      running_queue: [],
      pending_queue: [],
      installed_packs: {}
    },
    isProcessingTasks: false,
    resetTaskState: vi.fn()
  })
}))

vi.mock('@/workbench/extensions/manager/composables/useApplyChanges', () => ({
  useApplyChanges: () => ({
    isRestarting: { value: false },
    isRestartCompleted: { value: false },
    applyChanges: vi.fn()
  })
}))

import ManagerProgressToast from './ManagerProgressToast.vue'

// HoneyToast stub that emits update:expanded on mount to expand the component
const HoneyToastStub = defineComponent({
  name: 'HoneyToastStub',
  emits: ['update:expanded'],
  setup(_, { emit, slots }) {
    onMounted(() => {
      emit('update:expanded', true)
    })
    return () =>
      h('div', { 'data-testid': 'honey-toast' }, [
        slots.default?.(),
        slots.footer?.({ toggle: () => {} })
      ])
  }
})

const renderComponent = async () => {
  const result = render(ManagerProgressToast, {
    global: {
      plugins: [PrimeVue, createTestingPinia({ stubActions: false })],
      stubs: {
        HoneyToast: HoneyToastStub,
        DotSpinner: true,
        Panel: {
          template: '<div><slot name="header" /><slot /></div>'
        },
        TabMenu: {
          template: `
            <div data-testid="tab-menu">
              <template v-for="(item, index) in model" :key="index">
                <slot name="item" :item="item" :props="{ action: {} }" :label="item.label" />
              </template>
            </div>
          `,
          props: ['model', 'activeIndex']
        }
      }
    }
  })
  // Wait for the emit to propagate
  await new Promise((resolve) => setTimeout(resolve, 0))
  return result
}

describe('ManagerProgressToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFailedTasksIds.value = []
  })

  describe('failure indicator', () => {
    it('does not show failure indicator when there are no failures', async () => {
      mockFailedTasksIds.value = []
      await renderComponent()

      // When there are no failures, the failed tab should NOT have an
      // aria-label with the indicator tooltip
      const failedTabWithIndicator = screen.queryByLabelText(
        /failedTabIndicatorTooltip/
      )
      expect(failedTabWithIndicator).toBeNull()
    })

    it('shows failure indicator aria-label when there are failures', async () => {
      mockFailedTasksIds.value = ['task-1', 'task-2']
      await renderComponent()

      // When there are failures, the failed tab should have an aria-label
      // containing the indicator tooltip with the count
      const failedTabWithIndicator = screen.getByLabelText(
        /failedTabIndicatorTooltip:2/
      )
      expect(failedTabWithIndicator).toBeInTheDocument()
    })

    it('shows title tooltip with failure count on Failed tab', async () => {
      mockFailedTasksIds.value = ['task-1', 'task-2', 'task-3']
      await renderComponent()

      // The aria-label should contain the count (3 in this case)
      const failedTabWithIndicator = screen.getByLabelText(
        /failedTabIndicatorTooltip:3/
      )
      expect(failedTabWithIndicator).toBeInTheDocument()
    })
  })
})
