import { app } from '../../scripts/app.js'

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

const directories = {
  '/': [
    { label: 'images/', value: '/images/', kind: 'directory' },
    { label: 'media/', value: '/media/', kind: 'directory' },
    { label: 'unavailable/', value: '/unavailable/', kind: 'directory' }
  ],
  '/images/': [
    { label: 'portrait.png', value: '/images/portrait.png', kind: 'file' },
    { label: 'intro.mp4', value: '/images/intro.mp4', kind: 'file' }
  ],
  '/media/': [
    { label: 'clips/', value: '/media/clips/', kind: 'directory' },
    { label: 'intro.mp4', value: '/media/intro.mp4', kind: 'file' },
    {
      label: 'scene [1], take #2.mp4',
      value: '/media/scene [1], take #2.mp4',
      kind: 'file'
    },
    { label: 'notes.txt', value: '/media/notes.txt', kind: 'file' }
  ],
  '/media/clips/': [
    { label: 'outro.mp4', value: '/media/clips/outro.mp4', kind: 'file' }
  ]
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}

const fileExtensions = new Map([
  ['path', '.mp4'],
  ['image', '.png']
])

const pathCompletion = {
  id: 'demo-media-paths',
  kind: 'path-completion',
  target: (widget) =>
    widget.nodeType.endsWith('PathCompletion') &&
    fileExtensions.has(widget.widgetName),
  async suggest(value, { signal, showAllFiles, widget }) {
    signal.throwIfAborted()
    await delay(300, signal)
    const slash = value.lastIndexOf('/')
    const directory = slash < 0 ? '/' : value.slice(0, slash + 1)
    const prefix = value.slice(slash + 1).toLowerCase()
    const items = directories[directory]
    if (!items) return { status: 'unavailable' }
    return {
      status: 'ready',
      items: items.filter(
        (item) =>
          item.label.toLowerCase().startsWith(prefix) &&
          (item.kind === 'directory' ||
            showAllFiles ||
            item.value.endsWith(fileExtensions.get(widget.widgetName)))
      )
    }
  },
  parent(value) {
    const path = value.replace(/\/+$/, '')
    return path.slice(0, path.lastIndexOf('/') + 1) || '/'
  }
}

export const extension = {
  name: 'DevTools.WidgetAugmentations',
  widgetAugmentations: [
    pathCompletion,
    {
      id: 'lighting-tags',
      kind: 'text-completion',
      target,
      suggest(query) {
        return tags.filter((tag) => tag.includes(query.toLowerCase()))
      }
    },
    {
      id: 'tag-count',
      kind: 'hint',
      target,
      text(value) {
        const count = value.split(/[,;\n]/).filter((tag) => tag.trim()).length
        return `${count} prompt tags`
      }
    },
    {
      id: 'normalize-tags',
      kind: 'text-action',
      target,
      label: 'Normalize tags',
      transform(value) {
        return value
          .split(/[,;\n]/)
          .map((tag) => tag.trim().replaceAll('_', ' '))
          .filter(Boolean)
          .join(', ')
      }
    }
  ]
}

app.registerExtension(extension)
