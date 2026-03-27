import { describe, expect, it } from 'vitest'

import { render, screen } from '@/utils/test-utils'

import { defineComponent, h } from 'vue'

const TestButton = defineComponent({
  props: { label: { type: String, required: true } },
  setup(props) {
    return () => h('button', { 'data-testid': 'test-btn' }, props.label)
  }
})

describe('test-utils', () => {
  it('renders a component with default plugins', () => {
    render(TestButton, { props: { label: 'Click me' } })
    expect(screen.getByTestId('test-btn')).toHaveTextContent('Click me')
  })

  it('provides a userEvent instance by default', () => {
    const { user } = render(TestButton, { props: { label: 'Click' } })
    expect(user).toBeDefined()
  })

  it('allows opting out of userEvent', () => {
    const { user } = render(TestButton, {
      props: { label: 'Click' },
      setupUser: false
    })
    expect(user).toBeUndefined()
  })
})
