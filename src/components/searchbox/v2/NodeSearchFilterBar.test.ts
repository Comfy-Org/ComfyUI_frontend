import { render, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import NodeSearchFilterBar from '@/components/searchbox/v2/NodeSearchFilterBar.vue'
import {
  createMockNodeDef,
  setupTestPinia,
  testI18n
} from '@/components/searchbox/v2/__test__/testUtils'
import { useNodeDefStore } from '@/stores/nodeDefStore'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => undefined),
    set: vi.fn()
  }))
}))

describe(NodeSearchFilterBar, () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setupTestPinia()
    useNodeDefStore().updateNodeDefs([
      createMockNodeDef({
        name: 'ImageNode',
        input: { required: { image: ['IMAGE', {}] } },
        output: ['IMAGE']
      })
    ])
  })

  async function createRender(props = {}) {
    const user = userEvent.setup()
    const onSelectChip = vi.fn()
    const { container } = render(NodeSearchFilterBar, {
      props: { onSelectChip, ...props },
      global: { plugins: [testI18n] }
    })
    await nextTick()
    const view = within(container as HTMLElement)
    return { user, onSelectChip, view }
  }

  it('should render all filter chips', async () => {
    const { view } = await createRender()

    const buttons = view.getAllByRole('button')
    expect(buttons).toHaveLength(6)
    expect(buttons[0]).toHaveTextContent('Blueprints')
    expect(buttons[1]).toHaveTextContent('Partner Nodes')
    expect(buttons[2]).toHaveTextContent('Essentials')
    expect(buttons[3]).toHaveTextContent('Extensions')
    expect(buttons[4]).toHaveTextContent('Input')
    expect(buttons[5]).toHaveTextContent('Output')
  })

  it('should mark active chip as pressed when activeChipKey matches', async () => {
    const { view } = await createRender({ activeChipKey: 'input' })

    expect(view.getByRole('button', { name: 'Input' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('should not mark chips as pressed when activeChipKey does not match', async () => {
    const { view } = await createRender({ activeChipKey: null })

    view.getAllByRole('button').forEach((btn) => {
      expect(btn).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('should emit selectChip with chip data when clicked', async () => {
    const { user, onSelectChip, view } = await createRender()

    await user.click(view.getByRole('button', { name: 'Input' }))

    expect(onSelectChip).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'input',
        label: 'Input',
        filter: expect.anything()
      })
    )
  })
})
