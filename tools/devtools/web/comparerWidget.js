// eslint-disable-next-line import-x/no-unresolved -- import is correct at time of test execution
import { app } from '../../scripts/app.js'

const NODE_TYPE = 'DevToolsNodeWithComparerWidget'
const WIDGET_NAME = 'devtools_comparer'

const EXECUTED_IMAGES = [
  { name: 'A', selected: true, url: '/devtools/comparer/a.png' },
  { name: 'B', selected: true, url: '/devtools/comparer/b.png' }
]

/** @see https://github.com/rgthree/rgthree-comfy/blob/main/web/comfyui/image_comparer.js */
class ComparerWidget {
  constructor(name, node) {
    this.name = name
    this.type = 'custom'
    this.options = {}
    this.y = 0
    this.selected = []
    this._value = { images: [] }
    this.node = node
  }

  set value(v) {
    let cleanedVal
    if (Array.isArray(v)) {
      cleanedVal = v.map((d, i) => {
        if (!d || typeof d === 'string') {
          d = { url: d, name: i == 0 ? 'A' : 'B', selected: true }
        }
        return d
      })
    } else {
      cleanedVal = v.images || []
    }
    this._value.images = cleanedVal
    this.selected = cleanedVal.filter((d) => d.selected)
  }

  get value() {
    return this._value
  }

  draw(ctx, node, width, y, height) {
    ctx.save()
    ctx.fillStyle = '#333'
    ctx.fillRect(15, y, width - 15 * 2, height)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillText(this.selected.map((d) => d.name).join(' '), 20, y)
    ctx.restore()
  }
}

app.registerExtension({
  name: 'DevTools.ComparerWidget',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return

    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function (...args) {
      onNodeCreated?.apply(this, args)
      this.serialize_widgets = true
      this.comparerWidget = this.addCustomWidget(
        new ComparerWidget(WIDGET_NAME, this)
      )
      this.comparerWidget.value = {
        images: EXECUTED_IMAGES.map((image) => ({ ...image }))
      }
    }

    const onSerialize = nodeType.prototype.onSerialize
    nodeType.prototype.onSerialize = function (serialised) {
      onSerialize?.call(this, serialised)
      for (const [index] of (serialised.widgets_values || []).entries()) {
        if (this.widgets[index]?.name === WIDGET_NAME) {
          serialised.widgets_values[index] = this.widgets[
            index
          ].value.images.map((d) => {
            d = { ...d }
            delete d.img
            return d
          })
        }
      }
    }
  }
})
