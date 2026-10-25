//es
import { app } from '../../scripts/app.js'

function legacyWidget(node, inputName, _inputData) {
  if (!node.widgets) node.widgets = []
  const widget = {
    draw: function (ctx, _node, widget_width, y, H) {
      ctx.save()
      ctx.fillStyle = '#7F7'
      ctx.fillRect(15, y, widget_width - 15 * 2, H)
      ctx.restore()
    },
    mouse: function mouseAnnotated(_event, [x, _y], node) {
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
      case 'DevToolsFancyTimer':
        node.onSerialize = function (o) {
          o.properties = this.properties
        }
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

if (
  localStorage.getItem('Comfy.DevTools.LegacyGraphInstancePatches') === 'true'
) {
  const fired = {
    bootOnNodeAdded: [],
    overwriteOnNodeRemoved: [],
    configure: 0,
    serialize: 0,
    clear: 0,
    beforeChange: 0,
    afterChange: 0,
    add: [],
    remove: [],
    stackedAfterChange: [],
    safeOnNodeAdded: []
  }
  window.__legacyGraphInstancePatches = fired
  const safelyHookedGraphs = new WeakSet()

  if (localStorage.getItem('Comfy.DevTools.TargetedGraphPatches') === 'true') {
    const allowedMembers = new Map([
      [
        'DevTools.LegacyGraphInstancePatches.Boot',
        [
          'onNodeAdded',
          'onNodeRemoved',
          'configure',
          'serialize',
          'clear',
          'beforeChange',
          'afterChange',
          'add',
          'remove'
        ]
      ]
    ])
    const patches = new Map()
    const registerExtension = app.registerExtension
    app.registerExtension = function (extension) {
      const members = allowedMembers.get(extension.name)
      if (!members || !extension.setup)
        return registerExtension.call(this, extension)
      const setup = extension.setup
      return registerExtension.call(this, {
        ...extension,
        setup(...args) {
          const graph = app.graph
          const previous = new Map(members.map((name) => [name, graph[name]]))
          const result = setup.apply(this, args)
          const changed = members.filter(
            (name) =>
              typeof graph[name] === 'function' &&
              graph[name] !== previous.get(name)
          )
          for (const name of changed) patches.set(name, graph[name])
          if (changed.length)
            console.warn(
              `${extension.name} uses temporary graph patch compatibility. Update the extension to install hooks per graph.`
            )
          return result
        }
      })
    }
    const createRootGraph = app.createRootGraph
    app.createRootGraph = function () {
      const graph = createRootGraph.call(this)
      for (const [name, patch] of patches) graph[name] = patch
      return graph
    }
  }

  function hookGraphOnce(graph) {
    if (safelyHookedGraphs.has(graph)) return
    safelyHookedGraphs.add(graph)
    const previous = graph.onNodeAdded
    graph.onNodeAdded = function (node) {
      previous?.call(this, node)
      fired.safeOnNodeAdded.push(String(node.id))
    }
  }

  app.registerExtension({
    name: 'DevTools.LegacyGraphInstancePatches.Boot',
    setup() {
      const graph = app.graph
      const previousOnNodeAdded = graph.onNodeAdded
      graph.onNodeAdded = function (node) {
        previousOnNodeAdded?.call(this, node)
        fired.bootOnNodeAdded.push(String(node.id))
      }
      graph.onNodeRemoved = function (node) {
        fired.overwriteOnNodeRemoved.push(String(node.id))
      }
      for (const name of [
        'configure',
        'serialize',
        'clear',
        'beforeChange',
        'afterChange'
      ]) {
        const previous = graph[name]
        graph[name] = function (...args) {
          fired[name]++
          return previous.apply(this, args)
        }
      }
      for (const name of ['add', 'remove']) {
        const previous = graph[name]
        graph[name] = function (item, ...args) {
          if (item?.id !== undefined) fired[name].push(String(item.id))
          return previous.call(this, item, ...args)
        }
      }
    }
  })

  app.registerExtension({
    name: 'DevTools.LegacyGraphInstancePatches.GraphLocal',
    setup() {
      const graph = app.graph
      hookGraphOnce(graph)
      if (
        localStorage.getItem('Comfy.DevTools.ReplayGraphPatches') === 'true'
      ) {
        const createRootGraph = app.createRootGraph
        app.createRootGraph = function () {
          const next = createRootGraph.call(this)
          for (const name of [
            'onNodeAdded',
            'onNodeRemoved',
            'configure',
            'serialize',
            'clear',
            'beforeChange',
            'afterChange',
            'add',
            'remove'
          ]) {
            next[name] = graph[name]
          }
          return next
        }
      }
    },
    nodeCreated(node) {
      if (node.comfyClass !== 'ConditioningZeroOut') return
      const graph = app.graph
      const previous = graph.afterChange
      graph.afterChange = function (...args) {
        const result = previous.apply(this, args)
        fired.stackedAfterChange.push(String(node.id))
        return result
      }
    },
    afterLoadGraph() {
      hookGraphOnce(app.graph)
    }
  })
}
