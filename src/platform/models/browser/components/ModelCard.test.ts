import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { ComfyModelDef } from '@/stores/modelStore'
import type { EnrichedModel } from '@/platform/models/browser/types/modelBrowserTypes'
import { transformToEnrichedModel } from '@/platform/models/browser/utils/modelTransform'

import ModelCard from './ModelCard.vue'

describe('ModelCard', () => {
  function createMockModel(
    overrides: Partial<EnrichedModel> = {}
  ): EnrichedModel {
    const comfyModel = new ComfyModelDef(
      'test_model.safetensors',
      'checkpoints',
      0
    )
    return {
      ...transformToEnrichedModel(comfyModel),
      ...overrides
    }
  }

  const globalMocks = {
    $t: (key: string) => key
  }

  it('should render model name', () => {
    const model = createMockModel({
      displayName: 'Test Model'
    })
    const wrapper = mount(ModelCard, {
      props: { model },
      global: { mocks: globalMocks }
    })

    expect(wrapper.text()).toContain('Test Model')
  })

  it('should render model type badge', () => {
    const model = createMockModel({
      type: 'CHECKPOINT'
    })
    const wrapper = mount(ModelCard, {
      props: { model },
      global: { mocks: globalMocks }
    })

    expect(wrapper.text()).toContain('CHECKPOINT')
  })

  it('should render file size when available', () => {
    const model = createMockModel({
      size: 6938040682
    })
    const wrapper = mount(ModelCard, {
      props: { model },
      global: { mocks: globalMocks }
    })

    expect(wrapper.text()).toContain('6.5 GB')
  })

  it('should render modified date when size not available', () => {
    const model = createMockModel({
      modified: 1704067200,
      size: undefined
    })
    const wrapper = mount(ModelCard, {
      props: { model },
      global: { mocks: globalMocks }
    })

    expect(wrapper.text()).toContain('2023')
  })

  it('should apply focused styles when focused prop is true', () => {
    const model = createMockModel()
    const wrapper = mount(ModelCard, {
      props: { model, focused: true },
      global: { mocks: globalMocks }
    })

    const cardElement = wrapper.find('[data-focused="true"]')
    expect(cardElement.exists()).toBe(true)
  })

  it('should emit focus event on click', async () => {
    const model = createMockModel()
    const wrapper = mount(ModelCard, {
      props: { model },
      global: { mocks: globalMocks }
    })

    await wrapper.trigger('click')

    expect(wrapper.emitted('focus')).toBeTruthy()
    expect(wrapper.emitted('focus')?.[0]).toEqual([model])
  })

  it('should emit select event on double click', async () => {
    const model = createMockModel()
    const wrapper = mount(ModelCard, {
      props: { model },
      global: { mocks: globalMocks }
    })

    await wrapper.trigger('dblclick')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')?.[0]).toEqual([model])
  })

  it('should emit select event when Use button is clicked', async () => {
    const model = createMockModel()
    const wrapper = mount(ModelCard, {
      props: { model },
      global: { mocks: globalMocks }
    })

    const buttons = wrapper.findAll('button')
    const useButton = buttons[buttons.length - 1]

    await useButton.trigger('click')
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')?.[0]).toEqual([model])
  })

  it('should emit show-info event on Enter key', async () => {
    const model = createMockModel()
    const wrapper = mount(ModelCard, {
      props: { model },
      global: { mocks: globalMocks }
    })

    await wrapper.trigger('keydown.enter')

    expect(wrapper.emitted('show-info')).toBeTruthy()
    expect(wrapper.emitted('show-info')?.[0]).toEqual([model])
  })

  it('should emit show-info event when info button is clicked', async () => {
    const model = createMockModel()
    const wrapper = mount(ModelCard, {
      props: { model },
      global: { mocks: globalMocks }
    })

    const infoButton = wrapper
      .findAll('button')
      .find((btn) => btn.attributes('aria-label')?.includes('showInfo'))
    expect(infoButton).toBeDefined()

    if (infoButton) {
      await infoButton.trigger('click')
      expect(wrapper.emitted('show-info')).toBeTruthy()
      expect(wrapper.emitted('show-info')?.[0]).toEqual([model])
    }
  })

  it('should render preview image with correct src', () => {
    const model = createMockModel({
      previewUrl:
        '/api/experiment/models/preview/checkpoints/0/test.safetensors'
    })
    const wrapper = mount(ModelCard, {
      props: { model },
      global: { mocks: globalMocks }
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(model.previewUrl)
    expect(img.attributes('alt')).toBe(model.displayName)
  })

  it('should show gradient fallback when image fails to load', async () => {
    const model = createMockModel()
    const wrapper = mount(ModelCard, {
      props: { model },
      global: { mocks: globalMocks }
    })

    const img = wrapper.find('img')
    await img.trigger('error')

    await wrapper.vm.$nextTick()

    const fallback = wrapper.find('.bg-gradient-to-br')
    expect(fallback.exists()).toBe(true)
  })

  it('should handle missing optional data gracefully', () => {
    const model = createMockModel({
      size: undefined,
      modified: undefined,
      description: undefined,
      tags: undefined
    })

    expect(() => {
      mount(ModelCard, {
        props: { model },
        global: { mocks: globalMocks }
      })
    }).not.toThrow()
  })
})
