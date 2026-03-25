import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TransformPane from './TransformPane.vue'

describe('TransformPane', () => {
  it('has ph-no-capture class to exclude from PostHog session recording', () => {
    const wrapper = mount(TransformPane)
    const root = wrapper.find('[data-testid="transform-pane"]')
    expect(root.classes()).toContain('ph-no-capture')
  })
})
