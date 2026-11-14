import type { WidgetAugmentation } from '../../src/platform/extensions/widgetAugmentation'

const tags = [
  'studio lighting',
  'studio portrait',
  'soft lighting',
  'soft focus',
  'cinematic lighting'
]

const target = {
  nodeType: 'DevToolsNodeWithAugmentedTextarea',
  widgetName: 'prompt'
}

const extension = {
  name: 'DevTools.WidgetAugmentations',
  widgetAugmentations: [
    {
      id: 'lighting-tags',
      kind: 'text-completion',
      target,
      suggest(query: string) {
        return tags.filter((tag) => tag.includes(query.toLowerCase()))
      }
    },
    {
      id: 'tag-count',
      kind: 'hint',
      target,
      text(value: string) {
        const count = value.split(/[,;\n]/).filter((tag) => tag.trim()).length
        return `${count} prompt tags`
      }
    },
    {
      id: 'normalize-tags',
      kind: 'text-action',
      target,
      label: 'Normalize tags',
      transform(value: string) {
        return value
          .split(/[,;\n]/)
          .map((tag) => tag.trim().replaceAll('_', ' '))
          .filter(Boolean)
          .join(', ')
      }
    }
  ] satisfies readonly WidgetAugmentation[]
}

export default extension
