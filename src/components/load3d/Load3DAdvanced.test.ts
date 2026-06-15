import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

const lastProps = ref<Record<string, unknown> | null>(null)

vi.mock('@/components/load3d/Load3D.vue', () => ({
  default: defineComponent({
    name: 'Load3D',
    props: {
      widget: { type: null, required: false, default: undefined },
      nodeId: { type: null, required: false, default: undefined },
      canUseRecording: { type: Boolean, default: true },
      canUseHdri: { type: Boolean, default: true },
      canUseBackgroundImage: { type: Boolean, default: true }
    },
    setup(props: Record<string, unknown>) {
      lastProps.value = { ...props }
      return () => h('div', { 'data-testid': 'load3d-stub' })
    }
  })
}))

import Load3DAdvanced from '@/components/load3d/Load3DAdvanced.vue'

describe('Load3DAdvanced', () => {
  it('renders the inner Load3D with all expressive features disabled', () => {
    const MOCK_NODE = { id: 'node', type: 'Load3DAdvanced' }
    render(Load3DAdvanced, {
      props: {
        widget: { node: MOCK_NODE } as never
      }
    })
    expect(lastProps.value).toMatchObject({
      canUseRecording: false,
      canUseHdri: false,
      canUseBackgroundImage: false
    })
  })

  it('forwards widget and nodeId to the inner Load3D', () => {
    const widget = { node: { id: 'a', type: 'Load3DAdvanced' } }
    render(Load3DAdvanced, { props: { widget: widget as never, nodeId: 'a' } })
    expect(lastProps.value?.widget).toEqual(widget)
    expect(lastProps.value?.nodeId).toBe('a')
  })
})
