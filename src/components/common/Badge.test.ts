import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Badge from './Badge.vue'
import { badgeVariants } from './badge.variants'

describe('Badge', () => {
  it('renders label text', () => {
    const wrapper = mount(Badge, { props: { label: 'NEW' } })
    expect(wrapper.text()).toBe('NEW')
  })

  it('renders numeric label', () => {
    const wrapper = mount(Badge, { props: { label: 5 } })
    expect(wrapper.text()).toBe('5')
  })

  it('defaults to dot variant when no label is provided', () => {
    const wrapper = mount(Badge)
    expect(wrapper.classes()).toContain('size-2')
  })

  it('defaults to label variant when label is provided', () => {
    const wrapper = mount(Badge, { props: { label: 'NEW' } })
    expect(wrapper.classes()).toContain('font-semibold')
    expect(wrapper.classes()).toContain('uppercase')
  })

  it('applies circle variant', () => {
    const wrapper = mount(Badge, {
      props: { label: '3', variant: 'circle' }
    })
    expect(wrapper.classes()).toContain('size-3.5')
  })

  it('merges custom class via cn()', () => {
    const wrapper = mount(Badge, {
      props: { label: 'Test', class: 'ml-2' }
    })
    expect(wrapper.classes()).toContain('ml-2')
    expect(wrapper.classes()).toContain('rounded-full')
  })

  describe('twMerge preserves color alongside text-3xs font size', () => {
    it.each([
      ['default', 'text-white'],
      ['secondary', 'text-white'],
      ['warn', 'text-white'],
      ['danger', 'text-white'],
      ['contrast', 'text-base-background']
    ] as const)(
      '%s severity retains its text color class',
      (severity, expectedColor) => {
        const classes = badgeVariants({ severity, variant: 'label' })
        expect(classes).toContain(expectedColor)
        expect(classes).toContain('text-3xs')
      }
    )

    it('cn() does not clobber text-white when merging with text-3xs', () => {
      const wrapper = mount(Badge, {
        props: { label: 'Test', severity: 'danger' }
      })
      const classList = wrapper.classes()
      expect(classList).toContain('text-white')
      expect(classList).toContain('text-3xs')
    })
  })
})
