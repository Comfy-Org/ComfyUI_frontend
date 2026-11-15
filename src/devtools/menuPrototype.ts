import Menu from '@comfyorg/design-system/menu/Menu'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import { createApp, defineComponent, h, reactive, ref } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import {
  installMenuBoundary,
  toClosureOnlyVueItems
} from './menuBoundaryPrototype'
import type { LegacyItems, MenuAction } from './menuBoundaryPrototype'

export function mountMenuPrototype() {
  if (!import.meta.env.DEV) return
  const state = reactive({
    builds: 0,
    core: 0,
    swaps: 0,
    found: '',
    layout: '',
    reason: ''
  })
  const node = {
    name: 'Disposable node A',
    width: 512,
    height: 768,
    getExtraMenuOptions(_canvas: object, _options: LegacyItems): void {}
  }
  const producer = (): MenuAction[] => {
    state.builds++
    return [
      { kind: 'action', label: 'Core action', run: () => state.core++ },
      { kind: 'action', label: 'Remove me', run: () => state.core++ },
      {
        kind: 'action',
        label: 'Disabled action',
        disabled: true,
        run: () => state.core++
      }
    ]
  }
  const canvas = { getMenuOptions: (): LegacyItems => [] }
  const restore = installMenuBoundary(canvas, producer)
  const extra = node.getExtraMenuOptions
  node.getExtraMenuOptions = function (canvas, options) {
    const result = extra.call(this, canvas, options)
    options.unshift({
      content: 'Swap width/height',
      callback: () => {
        const width = this.width
        this.width = this.height
        this.height = width
        state.swaps++
      }
    })
    return result
  }
  const base = canvas.getMenuOptions
  canvas.getMenuOptions = function () {
    const options = base.call(this)
    options.splice(1, 1)
    node.getExtraMenuOptions(this, options)
    return options
  }
  const swap = canvas.getMenuOptions
  canvas.getMenuOptions = function () {
    const options = swap.call(this)
    options.push({
      content: 'Go to node',
      has_submenu: true,
      submenu: {
        options: [
          {
            content: 'Type A',
            has_submenu: true,
            submenu: {
              options: [
                {
                  content: node.name,
                  callback: () => {
                    state.found = node.name
                  }
                }
              ]
            }
          }
        ]
      }
    })
    return options
  }
  const host = document.createElement('section')
  host.dataset.menuPrototype = ''
  document.body.append(host)
  const nativeMenus: InstanceType<typeof LiteGraph.ContextMenu>[] = []
  const openNative = (event: MouseEvent, boundary = false) => {
    const items = canvas.getMenuOptions()
    if (boundary)
      items.push({
        content: 'Connections layout (native event + parent)',
        has_submenu: true,
        callback: (_value, _options, event, parentMenu) => {
          nativeMenus.push(
            new LiteGraph.ContextMenu(
              [{ content: 'Left' }, { content: 'Right' }],
              {
                event,
                parentMenu,
                callback: (value) => {
                  if (typeof value === 'object')
                    state.layout = value.content ?? ''
                }
              }
            )
          )
        }
      })
    const menu = new LiteGraph.ContextMenu(items, { event })
    nativeMenus.push(menu)
    if (boundary) {
      menu.root
        .querySelectorAll<HTMLElement>('.litemenu-entry')
        .forEach((entry) => {
          entry.style.borderLeft = '3px solid #7c3aed'
        })
    }
  }
  const panel = createApp(
    defineComponent({
      setup() {
        const items = ref<MenuItem[]>([])
        const prepareVue = () => {
          const projected = toClosureOnlyVueItems(canvas.getMenuOptions())
          items.value = projected.kind === 'vue' ? projected.items : []
          state.reason = projected.kind === 'native' ? projected.reason : ''
        }
        return () =>
          h(
            'section',
            {
              class:
                'fixed left-6 top-20 z-50 w-96 rounded-lg border border-border bg-background p-5 text-foreground shadow-xl'
            },
            [
              h(
                'h2',
                { class: 'mb-3 text-lg font-semibold' },
                'Menu boundary prototype'
              ),
              h(
                'p',
                { class: 'mb-4' },
                'Disposable state only. One producer; final patched array; no callback comparisons.'
              ),
              h(
                Menu,
                { items: items.value, modal: false },
                {
                  trigger: () =>
                    h(
                      'button',
                      {
                        class: 'rounded border border-border px-3 py-2',
                        onPointerdown: prepareVue,
                        onKeydown: (event: KeyboardEvent) => {
                          if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
                            prepareVue()
                          }
                        }
                      },
                      'Vue: closure-only contract'
                    )
                }
              ),
              h(
                'button',
                {
                  class: 'mt-3 block rounded border border-border px-3 py-2',
                  onClick: (event: MouseEvent) => openNative(event)
                },
                'Native: same patched items'
              ),
              h(
                'button',
                {
                  class: 'mt-3 block rounded border border-border px-3 py-2',
                  onClick: (event: MouseEvent) => openNative(event, true)
                },
                'Native: imperative + DOM fixtures'
              ),
              h(
                'pre',
                {
                  class: 'my-4 whitespace-pre-wrap text-sm',
                  'aria-label': 'Prototype results'
                },
                JSON.stringify(
                  { ...state, width: node.width, height: node.height },
                  null,
                  2
                )
              ),
              h(
                'p',
                { class: 'text-sm' },
                'Vue does not promise legacy event/this/menu arguments. Constructor hooks and DOM styling stay native.'
              ),
              h(
                'button',
                { class: 'mt-3 underline', onClick: dispose },
                'Dispose prototype'
              )
            ]
          )
      }
    })
  )
  function dispose() {
    nativeMenus.forEach((menu) => menu.close())
    restore()
    panel.unmount()
    host.remove()
  }
  panel.mount(host)
  return { canvas, node, state, dispose }
}
