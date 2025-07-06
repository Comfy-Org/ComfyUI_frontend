import { VueWrapper, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import Button from 'primevue/button'
import PrimeVue from 'primevue/config'
import Panel from 'primevue/panel'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import ManagerProgressDialogContent from './ManagerProgressDialogContent.vue'

type ComponentInstance = InstanceType<typeof ManagerProgressDialogContent> & {
  lastPanelRef: HTMLElement | null
  onLogsAdded: () => void
  handleScroll: (e: { target: HTMLElement }) => void
  isUserScrolling: boolean
  resetUserScrolling: () => void
  collapsedPanels: Record<number, boolean>
  togglePanel: (index: number) => void
}

const mockCollapse = vi.fn()

const defaultMockTaskLogs = [
  { taskName: 'Task 1', logs: ['Log 1', 'Log 2'] },
  { taskName: 'Task 2', logs: ['Log 3', 'Log 4'] }
]

vi.mock('@/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn(() => ({
    taskLogs: [...defaultMockTaskLogs]
  })),
  useManagerProgressDialogStore: vi.fn(() => ({
    isExpanded: true,
    collapse: mockCollapse
  }))
}))

describe('ManagerProgressDialogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCollapse.mockReset()
  })

  const mountComponent = ({
    props = {}
  }: Record<string, any> = {}): VueWrapper<ComponentInstance> => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    return mount(ManagerProgressDialogContent, {
      props: {
        ...props
      },
      global: {
        plugins: [PrimeVue, createPinia(), i18n],
        components: {
          Panel,
          Button
        }
      }
    }) as VueWrapper<ComponentInstance>
  }

  it('renders the correct number of panels', async () => {
    const wrapper = mountComponent()
    await nextTick()
    expect(wrapper.findAllComponents(Panel).length).toBe(2)
  })

  it('expands the last panel by default', async () => {
    const wrapper = mountComponent()
    await nextTick()
    expect(wrapper.vm.collapsedPanels[1]).toBeFalsy()
  })

  it('toggles panel expansion when toggle method is called', async () => {
    const wrapper = mountComponent()
    await nextTick()

    // Initial state - first panel should be collapsed
    expect(wrapper.vm.collapsedPanels[0]).toBeFalsy()

    wrapper.vm.togglePanel(0)
    await nextTick()

    // After toggle - first panel should be expanded
    expect(wrapper.vm.collapsedPanels[0]).toBe(true)

    wrapper.vm.togglePanel(0)
    await nextTick()

    expect(wrapper.vm.collapsedPanels[0]).toBeFalsy()
  })

  it('displays the correct status for each panel', async () => {
    const wrapper = mountComponent()
    await nextTick()

    // Expand all panels to see status text
    const panels = wrapper.findAllComponents(Panel)
    for (let i = 0; i < panels.length; i++) {
      if (!wrapper.vm.collapsedPanels[i]) {
        wrapper.vm.togglePanel(i)
        await nextTick()
      }
    }

    const panelsText = wrapper
      .findAllComponents(Panel)
      .map((panel) => panel.text())

    expect(panelsText[0]).toContain('Completed ✓')
    expect(panelsText[1]).toContain('Completed ✓')
  })

  it('auto-scrolls to bottom when new logs are added', async () => {
    const wrapper = mountComponent()
    await nextTick()

    const mockScrollElement = document.createElement('div')
    Object.defineProperty(mockScrollElement, 'scrollHeight', { value: 200 })
    Object.defineProperty(mockScrollElement, 'clientHeight', { value: 100 })
    Object.defineProperty(mockScrollElement, 'scrollTop', {
      value: 0,
      writable: true
    })

    wrapper.vm.lastPanelRef = mockScrollElement

    wrapper.vm.onLogsAdded()
    await nextTick()

    // Check if scrollTop is set to scrollHeight (scrolled to bottom)
    expect(mockScrollElement.scrollTop).toBe(200)
  })

  it('does not auto-scroll when user is manually scrolling', async () => {
    const wrapper = mountComponent()
    await nextTick()

    const mockScrollElement = document.createElement('div')
    Object.defineProperty(mockScrollElement, 'scrollHeight', { value: 200 })
    Object.defineProperty(mockScrollElement, 'clientHeight', { value: 100 })
    Object.defineProperty(mockScrollElement, 'scrollTop', {
      value: 50,
      writable: true
    })

    wrapper.vm.lastPanelRef = mockScrollElement

    wrapper.vm.handleScroll({ target: mockScrollElement })
    await nextTick()

    expect(wrapper.vm.isUserScrolling).toBe(true)

    // Now trigger the log update
    wrapper.vm.onLogsAdded()
    await nextTick()

    // Check that scrollTop is not changed (should still be 50)
    expect(mockScrollElement.scrollTop).toBe(50)
  })

  it('calls collapse method when component is unmounted', async () => {
    const wrapper = mountComponent()
    await nextTick()
    wrapper.unmount()
    expect(mockCollapse).toHaveBeenCalled()
  })
})
