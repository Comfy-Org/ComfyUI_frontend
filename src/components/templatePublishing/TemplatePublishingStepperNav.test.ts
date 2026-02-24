import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import type { PublishingStepDefinition } from './types'

import TemplatePublishingStepperNav from './TemplatePublishingStepperNav.vue'

const STEP_DEFINITIONS: PublishingStepDefinition[] = [
  {
    number: 1,
    titleKey: 'steps.landing.title',
    descriptionKey: 'steps.landing.description'
  },
  {
    number: 2,
    titleKey: 'steps.metadata.title',
    descriptionKey: 'steps.metadata.description'
  },
  {
    number: 3,
    titleKey: 'steps.preview.title',
    descriptionKey: 'steps.preview.description'
  }
]

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      steps: {
        landing: { title: 'Getting Started', description: '' },
        metadata: { title: 'Metadata', description: '' },
        preview: { title: 'Preview', description: '' }
      }
    }
  }
})

function mountNav(props?: { currentStep?: number }) {
  return mount(TemplatePublishingStepperNav, {
    props: {
      currentStep: props?.currentStep ?? 1,
      stepDefinitions: STEP_DEFINITIONS
    },
    global: { plugins: [i18n] }
  })
}

describe('TemplatePublishingStepperNav', () => {
  it('renders a button for each step definition', () => {
    const wrapper = mountNav()
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(STEP_DEFINITIONS.length)
  })

  it('displays translated step titles', () => {
    const wrapper = mountNav()
    const buttons = wrapper.findAll('button')
    expect(buttons[0].text()).toContain('Getting Started')
    expect(buttons[1].text()).toContain('Metadata')
    expect(buttons[2].text()).toContain('Preview')
  })

  it('marks the current step button as aria-selected', () => {
    const wrapper = mountNav({ currentStep: 2 })
    const buttons = wrapper.findAll('button')
    expect(buttons[0].attributes('aria-selected')).toBe('false')
    expect(buttons[1].attributes('aria-selected')).toBe('true')
    expect(buttons[2].attributes('aria-selected')).toBe('false')
  })

  it('shows a check icon for completed steps', () => {
    const wrapper = mountNav({ currentStep: 3 })
    const buttons = wrapper.findAll('button')

    expect(buttons[0].find('i.icon-\\[lucide--check\\]').exists()).toBe(true)
    expect(buttons[1].find('i.icon-\\[lucide--check\\]').exists()).toBe(true)
    expect(buttons[2].find('i.icon-\\[lucide--check\\]').exists()).toBe(false)
  })

  it('shows step numbers for current and future steps', () => {
    const wrapper = mountNav({ currentStep: 2 })
    const buttons = wrapper.findAll('button')

    expect(buttons[0].find('i.icon-\\[lucide--check\\]').exists()).toBe(true)
    expect(buttons[1].text()).toContain('2')
    expect(buttons[2].text()).toContain('3')
  })

  it('emits update:currentStep when a step button is clicked', async () => {
    const wrapper = mountNav({ currentStep: 1 })
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('update:currentStep')).toEqual([[2]])
  })

  it('renders separators between steps', () => {
    const wrapper = mountNav()
    const separators = wrapper.findAll('div.bg-border-default')
    expect(separators).toHaveLength(STEP_DEFINITIONS.length - 1)
  })
})
