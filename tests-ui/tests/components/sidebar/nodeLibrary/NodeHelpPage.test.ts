import { flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import NodeHelpPage from '@/components/sidebar/tabs/nodeLibrary/NodeHelpPage.vue'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'

vi.mock('@/composables/graph/useSelectionState')
vi.mock('@/stores/workspace/nodeHelpStore')

const baseNode = {
  nodePath: 'NodeA',
  display_name: 'Node A',
  description: '',
  inputs: {},
  outputs: []
}

describe('NodeHelpPage', () => {
  const selection = ref<any | null>(null)
  let openHelp: ReturnType<typeof vi.fn>

  const mountPage = () =>
    mount(NodeHelpPage, {
      props: { node: baseNode as any },
      global: {
        mocks: {
          $t: (key: string) => key
        },
        stubs: {
          ProgressSpinner: true,
          Button: true
        }
      }
    })

  beforeEach(() => {
    vi.resetAllMocks()
    selection.value = null
    openHelp = vi.fn()

    vi.mocked(useSelectionState).mockReturnValue({
      nodeDef: computed(() => selection.value)
    } as any)

    vi.mocked(useNodeHelpStore).mockReturnValue({
      renderedHelpHtml: ref('<p>help</p>'),
      isLoading: ref(false),
      error: ref(null),
      isHelpOpen: true,
      currentHelpNode: { nodePath: 'NodeA' },
      openHelp,
      closeHelp: vi.fn()
    } as any)
  })

  test('opens help for a newly selected node while help is open', async () => {
    const wrapper = mountPage()

    selection.value = { nodePath: 'NodeB' }
    await flushPromises()

    expect(openHelp).toHaveBeenCalledWith({ nodePath: 'NodeB' })

    wrapper.unmount()
  })

  test('does not reopen help when the same node stays selected', async () => {
    const wrapper = mountPage()

    selection.value = { nodePath: 'NodeA' }
    await flushPromises()

    expect(openHelp).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  test('does not react to selection when help is closed', async () => {
    vi.mocked(useNodeHelpStore).mockReturnValueOnce({
      renderedHelpHtml: ref('<p>help</p>'),
      isLoading: ref(false),
      error: ref(null),
      isHelpOpen: false,
      currentHelpNode: null,
      openHelp,
      closeHelp: vi.fn()
    } as any)

    const wrapper = mountPage()

    selection.value = { nodePath: 'NodeB' }
    await flushPromises()

    expect(openHelp).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
