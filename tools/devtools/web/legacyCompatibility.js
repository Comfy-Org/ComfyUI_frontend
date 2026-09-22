//es
// eslint-disable-next-line import-x/no-unresolved -- import is correct at time of test execution
import { app } from '../../scripts/app.js'

function legacyWidget(node, inputName, inputData) {
  if (!node.widgets) node.widgets = []
  const widget = {
    draw: function (ctx, node, widget_width, y, H) {
      ctx.save()
      ctx.fillStyle = '#7F7'
      ctx.fillRect(15, y, widget_width - 15 * 2, H)
      ctx.restore()
    },
    mouse: function mouseAnnotated(event, [x, y], node) {
      const widget_width = this.width || node.size[0]
      if (x < 30) {
        this.value--
      } else if (x > widget_width - 30 && x < widget_width) {
        this.value++
      }
    },
    name: inputName,
    options: {},
    type: 'DEVTOOLS.LEGACYWIDGET',
    value: 0,
    y: 0
  }
  node.widgets.push(widget)
  return { widget }
}

app.registerExtension({
  name: 'DevTools.LegacyCompatibility',
  async getCustomWidgets() {
    return { DEVTOOLSLEGACYWIDGET: legacyWidget }
  },
  nodeCreated(node) {
    switch (node.comfyClass) {
      case 'DevToolsWASPause':
        addPauseButton(node)
        break
      case 'DevToolsRefModLoader':
        reorderRefModWidgets(node)
        break
      case 'DevToolsPreviewBridge':
        installPreviewBridgeSetter(node)
        break
    }
  }
})

function addPauseButton(node) {
  const held = new Set()
  node.properties.resumed = false
  const button = {
    name: 'Resume',
    type: 'button',
    value: null,
    options: {},
    y: 0,
    callback() {
      if (button.disabled) return
      held.delete(String(node.id))
      node.properties.resumed = true
      node.setDirtyCanvas(true, true)
    }
  }
  Object.defineProperty(button, 'disabled', {
    configurable: true,
    enumerable: true,
    get: () => !held.has(String(node.id)),
    set: () => {}
  })
  node.widgets = [button]
  node.setSize(node.computeSize())

  function pause(event) {
    if (event.detail !== String(node.id)) return
    node.properties.resumed = false
    held.add(String(node.id))
    node.color = '#7a5a1e'
    node.setDirtyCanvas(true, true)
  }
  window.addEventListener('devtools-was-pause', pause)
  const onRemoved = node.onRemoved
  node.onRemoved = function (...args) {
    window.removeEventListener('devtools-was-pause', pause)
    return onRemoved?.apply(this, args)
  }
}

function reorderRefModWidgets(node) {
  const schemaOrder = [...node.widgets]
  const showInfo = node.widgets.find((widget) => widget.name === 'show_info')
  const mods = Array.from({ length: 8 }, (_, index) =>
    node.widgets.find((widget) => widget.name === `mod_${index + 1}`)
  )
  const strengths = Array.from({ length: 8 }, (_, index) =>
    node.widgets.find((widget) => widget.name === `strength_${index + 1}`)
  )
  const serialize = node.serialize
  const configure = node.configure
  node.serialize = function () {
    const displayOrder = [...this.widgets]
    this.widgets = schemaOrder
    try {
      return serialize.call(this)
    } finally {
      this.widgets = displayOrder
    }
  }
  node.configure = function (info) {
    const displayOrder = [...this.widgets]
    this.widgets = schemaOrder
    try {
      configure.call(this, info)
    } finally {
      this.widgets = displayOrder
    }
    for (const [index, mod] of mods.entries()) {
      const visible =
        index === 0 || mod.value !== '(none)' || strengths[index].value !== 1
      mod.hidden = !visible
      strengths[index].hidden = !visible
    }
  }
  node.widgets = [
    ...mods.flatMap((mod, index) => [mod, strengths[index]]),
    showInfo
  ]
  for (const widget of [...mods.slice(1), ...strengths.slice(1)])
    widget.hidden = true
  node.setSize(node.computeSize())
}

function installPreviewBridgeSetter(node) {
  const image = node.widgets.find((widget) => widget.name === 'image')
  let previewId = image.value
  Object.defineProperty(image, 'value', {
    configurable: true,
    get: () => previewId,
    set(value) {
      if (value.startsWith('$')) {
        previewId = value
        return
      }
      void Promise.resolve().then(() => {
        node.properties.registeredMaskPath = value
        previewId = '$preview-after-mask'
      })
    }
  })
}
