import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@/platform/telemetry'
import { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeFrequencyStore } from '@/stores/nodeFrequencyStore'
import { FuseFilter } from '@/utils/fuseUtil'
import NodeSearchBox from './NodeSearchBox.vue'

vi.mock(import('@/platform/telemetry'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { g: { searchPlaceholder: 'Search {subject}', nodes: 'nodes' } }
  }
})

function renderComponent() {
  useNodeFrequencyStore().isLoaded = true
  useNodeDefStore().nodeDefsByName = {
    KSampler: new ComfyNodeDefImpl({
      name: 'KSampler',
      display_name: 'KSampler',
      category: 'sampling',
      python_module: 'nodes',
      description: '',
      input: {},
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    })
  }
  return render(NodeSearchBox, {
    props: { filters: [], filterVisible: false },
    global: {
      plugins: [i18n],
      stubs: {
        Button: true,
        Dialog: true,
        NodePreview: true,
        NodeSearchItem: true,
        NodeSearchFilter: true
      }
    }
  })
}

describe('NodeSearchBox', () => {
  it('uses the parent-owned filters after removing a filter', async () => {
    useNodeFrequencyStore().isLoaded = true
    const frequent = new ComfyNodeDefImpl({
      name: 'Frequent',
      display_name: 'Frequent',
      category: 'other',
      python_module: 'nodes',
      description: '',
      input: {},
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    })
    vi.spyOn(useNodeDefStore(), 'topNodeDefs', 'get').mockReturnValue([
      frequent
    ])
    const filter = new FuseFilter<ComfyNodeDefImpl>([], {
      id: 'category',
      name: 'Category',
      invokeSequence: 'c',
      getItemOptions: (node) => [node.category]
    })
    const Parent = defineComponent({
      components: { NodeSearchBox },
      setup() {
        const filters = ref([{ filterDef: filter, value: 'sampling' }])
        return { filters }
      },
      template: `
        <NodeSearchBox
          v-model:filter-visible="filterVisible"
          :filters="filters"
          @remove-filter="filters = filters.filter((item) => item !== $event)"
        />
      `,
      data: () => ({ filterVisible: false })
    })
    render(Parent, { global: { plugins: [i18n] } })

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /remove/i }))

    expect(screen.getByRole('option', { name: 'Frequent' })).toBeVisible()
  })

  it('tracks selection with the typed query', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderComponent()

    await fireEvent.update(screen.getByRole('combobox'), 'ksampler')
    await vi.advanceTimersByTimeAsync(100)
    await user.click(screen.getByRole('option', { name: 'KSampler' }))
    await vi.advanceTimersByTimeAsync(600)

    expect(useTelemetry()?.trackNodeSearchResultSelected).toHaveBeenCalledWith({
      node_type: 'KSampler',
      last_query: 'ksampler'
    })
    expect(useTelemetry()?.trackNodeSearch).toHaveBeenCalledExactlyOnceWith({
      query: 'ksampler'
    })
  })

  it.for([50, 100])(
    'cancels pending search telemetry when unmounted after %i ms',
    async (elapsed) => {
      vi.useFakeTimers()
      const { unmount } = renderComponent()

      await fireEvent.update(screen.getByRole('combobox'), 'ksampler')
      await vi.advanceTimersByTimeAsync(elapsed)
      unmount()
      await vi.advanceTimersByTimeAsync(600)

      expect(useTelemetry()?.trackNodeSearch).not.toHaveBeenCalled()
    }
  )
})
