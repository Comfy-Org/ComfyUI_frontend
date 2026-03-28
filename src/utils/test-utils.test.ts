/* eslint-disable vue/one-component-per-file, vue/no-reserved-component-names */
import { describe, expect, it, vi } from 'vitest'

import { render, screen, stubs } from '@/utils/test-utils'

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

describe('stubs', () => {
  describe('Button', () => {
    it('renders as a button element with label', () => {
      const Wrapper = defineComponent({
        components: { Button: stubs.Button },
        setup() {
          return () => h(stubs.Button, { label: 'Save' })
        }
      })
      render(Wrapper)
      expect(screen.getByRole('button')).toHaveTextContent('Save')
    })

    it('sets disabled when loading is true', () => {
      const Wrapper = defineComponent({
        setup() {
          return () => h(stubs.Button, { label: 'Save', loading: true })
        }
      })
      render(Wrapper)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('emits click event', async () => {
      const onClick = vi.fn()
      const Wrapper = defineComponent({
        setup() {
          return () => h(stubs.Button, { label: 'Go', onClick })
        }
      })
      const { user } = render(Wrapper)
      await user!.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalled()
    })
  })

  describe('Skeleton', () => {
    it('renders with data-testid', () => {
      const Wrapper = defineComponent({
        setup() {
          return () => h(stubs.Skeleton)
        }
      })
      render(Wrapper)
      expect(screen.getByTestId('skeleton')).toBeDefined()
    })
  })

  describe('Dialog', () => {
    it('renders children when visible', () => {
      const Wrapper = defineComponent({
        setup() {
          return () =>
            h(stubs.Dialog, { visible: true }, () => h('p', 'Dialog body'))
        }
      })
      render(Wrapper)
      expect(screen.getByRole('dialog')).toHaveTextContent('Dialog body')
    })

    it('renders nothing when not visible', () => {
      const Wrapper = defineComponent({
        setup() {
          return () =>
            h(stubs.Dialog, { visible: false }, () => h('p', 'Hidden'))
        }
      })
      render(Wrapper)
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
