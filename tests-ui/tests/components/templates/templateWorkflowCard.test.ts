import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TemplateWorkflowCard from '@/components/templates/TemplateWorkflowCard.vue'

describe('correctThumbnailVariant', () => {
  it('core default variant', async () => {
    const data = {
      sourceModule: 'default',
      categoryTitle: '',
      loading: false,
      template: {
        name: 'test',
        description: 'test',
        mediaType: 'image',
        mediaSubtype: 'webp'
      }
    }
    const wrapper = shallowMount(TemplateWorkflowCard, { propsData: data })
    // @ts-expect-error 'thumbnailVariant is computed'
    expect(wrapper.vm.thumbnailVariant).toBe(undefined)
  })

  it('core thumbnail variant', async () => {
    const data = {
      sourceModule: 'default',
      categoryTitle: '',
      loading: false,
      template: {
        name: 'test',
        description: 'test',
        mediaType: 'image',
        mediaSubtype: 'webp',
        thumbnailVariant: 'compareSlider'
      }
    }
    const wrapper = shallowMount(TemplateWorkflowCard, { propsData: data })
    // @ts-expect-error 'thumbnailVariant is computed'
    expect(wrapper.vm.thumbnailVariant).toBe('compareSlider')
  })

  it('custom node default variant', async () => {
    const data = {
      sourceModule: 'custom_node',
      categoryTitle: '',
      loading: false,
      template: {
        name: 'test',
        description: 'test',
        mediaType: 'image',
        mediaSubtype: 'webp'
      }
    }
    const wrapper = shallowMount(TemplateWorkflowCard, { propsData: data })
    // @ts-expect-error 'thumbnailVariant is computed'
    expect(wrapper.vm.thumbnailVariant).toBe(undefined)
  })

  it('custom node thumbnail variant', async () => {
    const data = {
      sourceModule: 'custom_node',
      categoryTitle: '',
      loading: false,
      template: {
        name: 'test.compareSlider',
        description: 'test',
        mediaType: 'image',
        mediaSubtype: 'webp'
      }
    }
    const wrapper = shallowMount(TemplateWorkflowCard, { propsData: data })
    // @ts-expect-error 'thumbnailVariant is computed'
    expect(wrapper.vm.thumbnailVariant).toBe('compareSlider')
  })
})

describe('correctNamingFromVariant', () => {
  it('core', async () => {
    const data = {
      sourceModule: 'default',
      categoryTitle: '',
      loading: false,
      template: {
        name: 'test',
        description: 'test',
        mediaType: 'image',
        mediaSubtype: 'webp'
      }
    }
    const wrapper = shallowMount(TemplateWorkflowCard, { propsData: data })
    // @ts-expect-error 'title is computed'
    expect(wrapper.vm.title).toBe('test')
  })

  it('custom node name without default variant', async () => {
    const data = {
      sourceModule: 'custom_node',
      categoryTitle: '',
      loading: false,
      template: {
        name: 'test',
        description: 'test',
        mediaType: 'image',
        mediaSubtype: 'webp'
      }
    }
    const wrapper = shallowMount(TemplateWorkflowCard, { propsData: data })
    // @ts-expect-error 'title is computed'
    expect(wrapper.vm.title).toBe('test')
  })

  it('custom node name with thumbnail variant', async () => {
    const data = {
      sourceModule: 'custom_node',
      categoryTitle: '',
      loading: false,
      template: {
        name: 'test.compareSlider',
        description: 'test',
        mediaType: 'image',
        mediaSubtype: 'webp'
      }
    }
    const wrapper = shallowMount(TemplateWorkflowCard, { propsData: data })
    // @ts-expect-error 'title is computed'
    expect(wrapper.vm.title).toBe('test')
  })
})
