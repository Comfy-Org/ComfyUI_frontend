import { describe, expect, it } from 'vitest'

import { workshopPages } from '../../config/workshop-page-content'
import { modelTitle } from './model-title'

const MAX_LENGTH = 60
const fullTitle = (name: string) => `${name} API & Playground - Comfy`
const nameOfLength = (length: number) => 'x'.repeat(length)

describe('modelTitle', () => {
  it.for([
    {
      name: 'names the API and playground when they fit',
      modelName: 'Seedream 4.0',
      expected: 'Seedream 4.0 API & Playground - Comfy'
    },
    {
      name: 'keeps the full title at exactly the limit',
      modelName: nameOfLength(35),
      expected: `${nameOfLength(35)} API & Playground - Comfy`
    },
    {
      name: 'drops the playground one character past the limit',
      modelName: nameOfLength(36),
      expected: `${nameOfLength(36)} API - Comfy`
    },
    {
      name: 'keeps the API title at exactly the limit',
      modelName: nameOfLength(48),
      expected: `${nameOfLength(48)} API - Comfy`
    },
    {
      name: 'falls back to the name alone when nothing else fits',
      modelName: nameOfLength(49),
      expected: `${nameOfLength(49)} - Comfy`
    },
    {
      name: 'writes the Chinese title with the Chinese conjunction',
      locale: 'zh-CN' as const,
      modelName: 'Seedream 4.0',
      expected: 'Seedream 4.0 API 与 Playground - Comfy'
    }
  ])('$name', ({ modelName, locale, expected }) => {
    expect(modelTitle({ name: modelName }, locale)).toBe(expected)
  })

  it('gives every model page a short, unique title that leads with its name', () => {
    expect(workshopPages.length).toBeGreaterThan(100)
    const titles = workshopPages.map((model) => {
      const title = modelTitle(model)
      expect(title.startsWith(`${model.name} `)).toBe(true)
      expect(title.length).toBeLessThanOrEqual(MAX_LENGTH)
      expect(title).not.toMatch(/undefined|· Models/)
      expect(title.endsWith(' - Comfy')).toBe(true)
      expect(title.split(' - Comfy')).toHaveLength(2)
      if (title !== fullTitle(model.name))
        expect(fullTitle(model.name).length).toBeGreaterThan(MAX_LENGTH)
      return title
    })
    expect(new Set(titles).size).toBe(titles.length)
  })
})
