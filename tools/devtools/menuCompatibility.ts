import type { LiteGraphGlobal } from '@/lib/litegraph/src/LiteGraphGlobal'
import { app } from '@/scripts/app'
import { closureOnly } from '@/scripts/nodeMenu'

declare const LiteGraph: LiteGraphGlobal

const scenario = new URL(import.meta.url).searchParams.get('scenario')

app.registerExtension({
  name: 'DevTools.MenuCompatibility',
  setup() {
    const previous = app.canvas.getNodeMenuOptions
    app.canvas.getNodeMenuOptions = function (node) {
      if (node.comfyClass !== 'EmptyLatentImage')
        return previous.call(this, node)
      if (scenario === 'replacement') {
        return [
          {
            content: 'Replacement only',
            callback: closureOnly(() => {
              node.title = 'Replacement selected'
            })
          }
        ]
      }
      const options = previous.call(this, node)
      const copy = options.findIndex((item) => item?.content === 'Copy')
      if (copy >= 0) options.splice(copy, 1)
      const pin = options.find((item) => item?.content === 'Pin')
      if (pin?.callback) {
        const original = pin.callback
        pin.callback = closureOnly(() => {
          Reflect.apply(original, undefined, [])
          node.properties.menuActionRuns =
            Number(node.properties.menuActionRuns ?? 0) + 1
          node.title = `Wrapped pin selected ${node.properties.menuActionRuns}`
        })
      }
      options.reverse()
      return options
    }
  },
  nodeCreated(node) {
    if (node.comfyClass !== 'EmptyLatentImage') return
    const previous = node.getExtraMenuOptions
    node.getExtraMenuOptions = function (canvas, options) {
      const result = previous?.call(this, canvas, options)
      if (scenario === 'native') {
        options.push({
          content: 'Native layout',
          has_submenu: true,
          callback: function (_value, _options, event, parentMenu, extra) {
            if (
              !(this instanceof HTMLElement) ||
              !event ||
              !parentMenu ||
              extra !== node
            )
              throw new Error('Native menu context was not preserved')
            node.title = 'Native submenu opened'
            new LiteGraph.ContextMenu(
              [
                {
                  content: 'Right',
                  callback: function () {
                    this.style.borderLeft = '3px solid purple'
                    node.title = 'Native right selected'
                  }
                }
              ],
              { event, parentMenu }
            )
            return true
          }
        })
      } else {
        options.push({
          content: 'Go to node',
          submenu: {
            options: [
              {
                content: 'Latent',
                submenu: {
                  options: [
                    {
                      content: 'Select latent',
                      callback: closureOnly(() => {
                        node.title = 'Nested action selected'
                      })
                    }
                  ]
                }
              }
            ]
          }
        })
        options.push(
          {
            content: 'Duplicate label',
            callback: closureOnly(() => {
              node.title = 'First duplicate selected'
            })
          },
          {
            content: 'Duplicate label',
            callback: closureOnly(() => {
              node.title = 'Second duplicate selected'
            })
          }
        )
      }
      return [
        ...(result ?? []),
        {
          content: 'Returned extra',
          callback: closureOnly(() => {
            node.title = 'Returned extra selected'
          })
        }
      ]
    }
  }
})
