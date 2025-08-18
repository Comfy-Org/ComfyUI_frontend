import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { components } from '@/types/comfyRegistryTypes'

import DescriptionTabPanel from './DescriptionTabPanel.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: enMessages
  }
})

const TRANSLATIONS = {
  description: 'Description',
  repository: 'Repository',
  license: 'License',
  noDescription: 'No description available'
}

describe('DescriptionTabPanel', () => {
  const mountComponent = (props: {
    nodePack: Partial<components['schemas']['Node']>
  }) => {
    return mount(DescriptionTabPanel, {
      props,
      global: {
        plugins: [i18n]
      }
    })
  }

  const getSectionByTitle = (
    wrapper: ReturnType<typeof mountComponent>,
    title: string
  ) => {
    const sections = wrapper
      .findComponent({ name: 'InfoTextSection' })
      .props('sections')
    return sections.find((s: any) => s.title === title)
  }

  const createNodePack = (
    overrides: Partial<components['schemas']['Node']> = {}
  ) => ({
    description: 'Test description',
    ...overrides
  })

  const licenseTests = [
    {
      name: 'handles plain text license',
      nodePack: createNodePack({
        license: 'MIT License',
        repository: 'https://github.com/user/repo'
      }),
      expected: {
        text: 'MIT License',
        isUrl: false
      }
    },
    {
      name: 'handles license file names',
      nodePack: createNodePack({
        license: 'LICENSE',
        repository: 'https://github.com/user/repo'
      }),
      expected: {
        text: 'https://github.com/user/repo/blob/main/LICENSE',
        isUrl: true
      }
    },
    {
      name: 'handles license.md file names',
      nodePack: createNodePack({
        license: 'license.md',
        repository: 'https://github.com/user/repo'
      }),
      expected: {
        text: 'https://github.com/user/repo/blob/main/license.md',
        isUrl: true
      }
    },
    {
      name: 'handles JSON license objects with text property',
      nodePack: createNodePack({
        license: JSON.stringify({ text: 'GPL-3.0' }),
        repository: 'https://github.com/user/repo'
      }),
      expected: {
        text: 'GPL-3.0',
        isUrl: false
      }
    },
    {
      name: 'handles JSON license objects with file property',
      nodePack: createNodePack({
        license: JSON.stringify({ file: 'LICENSE.md' }),
        repository: 'https://github.com/user/repo'
      }),
      expected: {
        text: 'https://github.com/user/repo/blob/main/LICENSE.md',
        isUrl: true
      }
    },
    {
      name: 'handles missing repository URL',
      nodePack: createNodePack({
        license: 'LICENSE'
      }),
      expected: {
        text: 'LICENSE',
        isUrl: false
      }
    },
    {
      name: 'handles non-GitHub repository URLs',
      nodePack: createNodePack({
        license: 'LICENSE',
        repository: 'https://gitlab.com/user/repo'
      }),
      expected: {
        text: 'https://gitlab.com/user/repo/blob/main/LICENSE',
        isUrl: true
      }
    }
  ]

  describe('license formatting', () => {
    licenseTests.forEach((test) => {
      it(test.name, () => {
        const wrapper = mountComponent({ nodePack: test.nodePack })
        const licenseSection = getSectionByTitle(wrapper, TRANSLATIONS.license)
        expect(licenseSection).toBeDefined()
        expect(licenseSection.text).toBe(test.expected.text)
        expect(licenseSection.isUrl).toBe(test.expected.isUrl)
      })
    })
  })

  describe('description sections', () => {
    it('shows description section', () => {
      const wrapper = mountComponent({
        nodePack: createNodePack()
      })
      const descriptionSection = getSectionByTitle(
        wrapper,
        TRANSLATIONS.description
      )
      expect(descriptionSection).toBeDefined()
      expect(descriptionSection.text).toBe('Test description')
    })

    it('shows repository section when available', () => {
      const wrapper = mountComponent({
        nodePack: createNodePack({
          repository: 'https://github.com/user/repo'
        })
      })
      const repoSection = getSectionByTitle(wrapper, TRANSLATIONS.repository)
      expect(repoSection).toBeDefined()
      expect(repoSection.text).toBe('https://github.com/user/repo')
      expect(repoSection.isUrl).toBe(true)
    })

    it('shows fallback text when description is missing', () => {
      const wrapper = mountComponent({
        nodePack: {
          description: undefined
        }
      })
      expect(wrapper.find('p').text()).toBe(TRANSLATIONS.noDescription)
    })
  })
})
