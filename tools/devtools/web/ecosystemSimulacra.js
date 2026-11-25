import { app } from '../../scripts/app.js'

if (localStorage.getItem('Comfy.DevTools.EcosystemSimulacra') === 'true') {
  const { LiteGraph } = window
  const heldTimers = new Map()
  let nextTimer = 1
  const simulacra = {
    lifecycle: [],
    registry: null,
    promptExecuted: [],
    executed: [],
    added: [],
    removed: [],
    timerErrors: [],
    navigationConfigured: [],
    timersHeld: () => heldTimers.size,
    releaseTimers() {
      const pending = [...heldTimers.values()]
      heldTimers.clear()
      for (const run of pending) {
        try {
          run()
        } catch (error) {
          simulacra.timerErrors.push(String(error))
        }
      }
    }
  }
  window.__ecosystemSimulacra = simulacra

  function vhsSetTimeout(run) {
    const id = nextTimer++
    heldTimers.set(id, run)
    return id
  }

  function vhsClearTimeout(id) {
    heldTimers.delete(id)
  }

  function chainCallback(object, property, callback) {
    if (object[property]) {
      const original = object[property]
      object[property] = function (...args) {
        const r = original.apply(this, args)
        return callback.apply(this, args) ?? r
      }
    } else {
      object[property] = callback
    }
  }

  function rootId(graph) {
    return String(graph?.rootGraph?.id ?? graph?.id)
  }

  app.registerExtension({
    name: 'DevTools.Simulacra.LoraManagerRegistry',
    beforeConfigureGraph(_graphData, _missingNodeTypes, _app, context) {
      simulacra.lifecycle.push({
        hook: 'beforeConfigureGraph',
        configured: rootId(context?.graph),
        active: rootId(app.graph)
      })
    },
    loadedGraphNode(node) {
      simulacra.lifecycle.push({
        hook: 'loadedGraphNode',
        configured: rootId(node.graph),
        active: rootId(app.graph)
      })
    },
    afterConfigureGraph(_missingNodeTypes, _app, context) {
      simulacra.lifecycle.push({
        hook: 'afterConfigureGraph',
        configured: rootId(context?.graph),
        active: rootId(app.graph)
      })
      simulacra.registry = {
        graph: rootId(app.graph),
        nodes: app.graph._nodes.map((node) => String(node.id))
      }
    },
    beforeLoadGraph() {
      simulacra.lifecycle.push({
        hook: 'beforeLoadGraph',
        configured: null,
        active: rootId(app.graph)
      })
    },
    afterLoadGraph() {
      simulacra.lifecycle.push({
        hook: 'afterLoadGraph',
        configured: null,
        active: rootId(app.graph)
      })
    }
  })

  function cloneType(nodeType) {
    chainCallback(nodeType.prototype, 'onNodeCreated', function () {
      this.changeOutputType = function (new_type) {
        this.linkTimeout = vhsSetTimeout(() => {
          this.linkTimeout = false
          if (this.outputs[0].type != new_type) {
            this.outputs[0].type = new_type
            if (!this.outputs[0].links) {
              return
            }
            const removed_links = []
            for (const link_id of this.outputs[0].links) {
              const link = app.graph.links[link_id]
              const target_node = app.graph.getNodeById(link.target_id)
              const target_input = target_node.inputs[link.target_slot]
              const keep = LiteGraph.isValidConnection(
                new_type,
                target_input.type
              )
              if (!keep) {
                link.disconnect(app.graph, 'input')
                removed_links.push(link_id)
              }
              target_node.onConnectionsChange?.(
                LiteGraph.INPUT,
                link.target_slot,
                keep,
                link,
                target_input
              )
            }
            this.outputs[0].links = this.outputs[0].links.filter(
              (v) => !removed_links.includes(v)
            )
          }
        })
      }
      this.changeOutputType('VHS_DUMMY_NONE')
    })
    chainCallback(
      nodeType.prototype,
      'onConnectionsChange',
      function (contype, slot, iscon, linf) {
        if (contype == LiteGraph.INPUT && slot == 0) {
          let new_type = 'VHS_DUMMY_NONE'
          if (iscon && linf) {
            new_type = app.graph.getNodeById(linf.origin_id).outputs[
              linf.origin_slot
            ].type
          }
          if (this.linkTimeout) {
            vhsClearTimeout(this.linkTimeout)
          }
          this.changeOutputType(new_type)
        }
      }
    )
  }

  let latentPreviewNodes = new Set()

  function getNodeById(id, graph = app.graph) {
    let cg = graph
    let node = undefined
    for (const sid of ('' + id).split(':')) {
      node = cg?.getNodeById?.(sid)
      cg = node?.subgraph
    }
    return node
  }

  function getLatentPreviewCtx(id) {
    const node = getNodeById(id)
    if (!node) {
      return undefined
    }
    let previewWidget = node.widgets?.find((w) => w.name == 'vhslatentpreview')
    if (!previewWidget) {
      const canvasEl = document.createElement('canvas')
      canvasEl.style.width = '100%'
      previewWidget = node.addDOMWidget(
        'vhslatentpreview',
        'vhscanvas',
        canvasEl,
        { serialize: false, hideOnZoom: false }
      )
      previewWidget.serialize = false
    }
    return previewWidget.element.getContext('2d')
  }

  function beginLatentPreview(id) {
    latentPreviewNodes.add(id)
    getLatentPreviewCtx(id)
  }

  app.registerExtension({
    name: 'DevTools.Simulacra.VideoHelperSuite',
    settings: [
      {
        id: 'DevTools.Simulacra.LatentPreview',
        category: ['DevTools', 'Simulacra', 'Latent Previews'],
        name: 'Display animated previews when sampling',
        type: 'boolean',
        defaultValue: false,
        onChange(value) {
          if (!value) {
            for (const id of latentPreviewNodes) {
              const n = app.graph.getNodeById(id)
              const i = n?.widgets?.findIndex(
                (w) => w.name == 'vhslatentpreview'
              )
              if (i >= 0) {
                n.widgets.splice(i, 1)[0].onRemove()
              }
            }
            latentPreviewNodes = new Set()
          }
        }
      }
    ],
    registerCustomNodes() {
      class SimulacraUnbatch extends LiteGraph.LGraphNode {
        constructor(title) {
          super(title)
          this.addInput('images', '*')
          this.addOutput('IMAGE', '*')
          this.isVirtualNode = true
        }
      }
      SimulacraUnbatch.title = 'Simulacra Unbatch'
      cloneType(SimulacraUnbatch)
      LiteGraph.registerNodeType('DevToolsSimulacraUnbatch', SimulacraUnbatch)
    },
    nodeCreated(node) {
      if (node.comfyClass !== 'SaveImage') return
      node.onPromptExecuted = function () {
        simulacra.promptExecuted.push(`${rootId(this.graph)}:${this.id}`)
      }
      chainCallback(node, 'onExecuted', function () {
        simulacra.executed.push(`${rootId(this.graph)}:${this.id}`)
      })
    },
    setup() {
      app.api.addEventListener('executing', ({ detail }) => {
        if (detail === null) {
          for (const graph of [app.graph, ...app.graph.subgraphs.values()]) {
            for (const node of graph._nodes) {
              if (node.type === 'SaveImage') {
                node.onPromptExecuted?.()
              }
            }
          }
        }
      })
      app.api.addEventListener('VHS_latentpreview', ({ detail }) => {
        if (detail.id == null) {
          return
        }
        const idParts = detail.id.split(':')
        for (let i = 1; i <= idParts.length; i++) {
          beginLatentPreview(idParts.slice(0, i).join(':'))
        }
      })
    }
  })

  const navigation = { groups: [] }
  simulacra.navigation = navigation

  app.registerExtension({
    name: 'DevTools.Simulacra.DanbooruQuickGroupNavigation',
    setup() {
      const originalSerialize = app.graph.serialize
      app.graph.serialize = function () {
        const data = originalSerialize.call(this)
        if (!data.extra) {
          data.extra = {}
        }
        data.extra.qgn_navigation_groups = navigation.groups
        return data
      }
      const originalConfigure = app.graph.configure
      app.graph.configure = function (data) {
        const result = originalConfigure.call(this, data)
        simulacra.navigationConfigured.push(rootId(this))
        if (data.extra?.qgn_navigation_groups) {
          navigation.groups = data.extra.qgn_navigation_groups
        }
        return result
      }
    }
  })

  app.registerExtension({
    name: 'DevTools.Simulacra.HalxpPrettyJson',
    setup() {
      if (app.graph && app.graph.serialize) {
        const originalSerialize = app.graph.serialize.bind(app.graph)
        app.graph.serialize = function () {
          const result = originalSerialize()
          result._prettyPrint = true
          return result
        }
      }
    }
  })

  app.registerExtension({
    name: 'DevTools.Simulacra.JdcnLoadImageF',
    setup() {
      const originalNodeAdded = app.graph.onNodeAdded
        ? app.graph.onNodeAdded.bind(app.graph)
        : null
      const originalNodeRemoved = app.graph.onNodeRemoved
        ? app.graph.onNodeRemoved.bind(app.graph)
        : null
      app.graph.onNodeAdded = function (node) {
        if (originalNodeAdded) originalNodeAdded(node)
        simulacra.added.push(String(node.id))
      }
      app.graph.onNodeRemoved = function (node) {
        if (originalNodeRemoved) originalNodeRemoved(node)
        simulacra.removed.push(String(node.id))
      }
    }
  })

  app.registerExtension({
    name: 'DevTools.Simulacra.CustomScriptsSwapResolution',
    beforeRegisterNodeDef(nodeType, nodeData) {
      const inputs = {
        ...nodeData.input?.required,
        ...nodeData.input?.optional
      }
      if (!('width' in inputs) || !('height' in inputs)) return
      const previous = nodeType.prototype.getExtraMenuOptions
      nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
        const result = previous?.call(this, canvas, options) ?? []
        options.push(
          {
            content: 'Swap width/height',
            callback: () => {
              const width = this.widgets?.find((w) => w.name === 'width')
              const height = this.widgets?.find((w) => w.name === 'height')
              if (!width || !height) return
              const value = width.value
              width.value = height.value
              height.value = value
              app.graph.setDirtyCanvas(true)
            }
          },
          null
        )
        return result
      }
    }
  })

  app.registerExtension({
    name: 'DevTools.Simulacra.CustomScriptsNodeFinder',
    setup() {
      const previous = app.canvas.getNodeMenuOptions
      app.canvas.getNodeMenuOptions = function (node) {
        const options = previous.call(this, node)
        const nodes = app.graph._nodes
        const types = [...new Set(nodes.map((target) => target.type))].sort(
          (a, b) => a.localeCompare(b)
        )
        options.push({
          content: 'Go to node',
          has_submenu: true,
          submenu: {
            options: types.map((type) => ({
              content: type,
              has_submenu: true,
              submenu: {
                options: nodes
                  .filter((target) => target.type === type)
                  .toSorted((a, b) => a.pos[0] - b.pos[0])
                  .map((target) => ({
                    content: `${target.getTitle()} - #${target.id} (${target.pos[0]}, ${target.pos[1]})`,
                    callback: () => app.canvas.centerOnNode(target)
                  }))
              }
            }))
          }
        })
        return options
      }
    }
  })

  app.registerExtension({
    name: 'DevTools.Simulacra.RgthreeConnectionsLayout',
    nodeCreated(node) {
      if (node.comfyClass !== 'EmptyLatentImage') return
      const previous = node.getExtraMenuOptions
      node.getExtraMenuOptions = function (canvas, options) {
        const result = previous?.call(this, canvas, options) ?? []
        const index = options.findIndex((item) =>
          item?.content?.includes('Shape')
        )
        options.splice(index + 1, 0, null, {
          content: 'Connections Layout',
          has_submenu: true,
          callback: (_value, _options, event, parentMenu) => {
            new LiteGraph.ContextMenu(
              ['Left -> Right', 'Right -> Left'].map((content) => ({
                content
              })),
              {
                event,
                parentMenu,
                callback: (value) => {
                  if (!value || typeof value === 'string') return
                  node.properties.connections_layout =
                    value.content?.split(' -> ')
                  node.graph?.setDirtyCanvas(true, true)
                }
              }
            )
          }
        })
        return result
      }
    }
  })

  app.registerExtension({
    name: 'DevTools.Simulacra.RgthreeQueueSelectedOutputNodes',
    nodeCreated(node) {
      const previous = node.getExtraMenuOptions
      node.getExtraMenuOptions = function (canvas, options) {
        const result = previous?.call(this, canvas, options) ?? []
        const outputNodes = Object.values(app.canvas.selected_nodes).filter(
          (target) => target.constructor.nodeData?.output_node
        )
        let index =
          options.findIndex((option) => option?.content === 'Outputs') + 1
        index ||= options.findIndex((option) => option?.content === 'Align') + 1
        index ||= 3
        options.splice(index, 0, {
          content: 'Queue Selected Output Nodes (rgthree) &nbsp;',
          className: 'rgthree-contextmenu-item',
          callback: () => {
            for (const target of outputNodes) target.properties.queued = true
          },
          disabled: !outputNodes.length
        })
        return result
      }
    }
  })

  app.registerExtension({
    name: 'DevTools.Simulacra.RgthreePowerPrimitiveSetType',
    nodeCreated(node) {
      if (node.comfyClass !== 'KSampler') return
      const previous = node.getExtraMenuOptions
      node.getExtraMenuOptions = function (canvas, options) {
        previous?.call(this, canvas, options)
        const widget = node.widgets?.find((w) => w.name === 'sampler_name')
        const values = widget?.options.values
        if (!widget || !Array.isArray(values)) return []
        options.splice(
          0,
          0,
          {
            content: 'Set sampler',
            submenu: {
              options: values.slice(0, 3).map(String),
              callback(value) {
                widget.value = String(value)
              }
            }
          },
          null
        )
        return []
      }
    }
  })

  function useEverywhereInputsSubmenu(
    _value,
    _options,
    event,
    parentMenu,
    node
  ) {
    const stored = node.properties.input_ue_unconnectable
    const unconnectable = typeof stored === 'object' ? { ...stored } : {}
    node.properties.input_ue_unconnectable = unconnectable
    const names = node.inputs
      .filter((input) => !input.widget)
      .map((input) => input.name)
    const markConnectable = (root) =>
      names.forEach((name, index) => {
        const entry = root?.querySelector(`:nth-child(${index + 1})`)
        if (entry)
          entry.style.borderLeft = unconnectable[name] ? '' : '2px solid #484'
      })
    const submenu = new LiteGraph.ContextMenu(names, {
      event,
      parentMenu,
      callback(name) {
        if (typeof name !== 'string') return
        unconnectable[name] = !unconnectable[name]
        markConnectable(this?.parentElement)
        return true
      }
    })
    markConnectable(submenu.root)
  }

  app.registerExtension({
    name: 'DevTools.Simulacra.UseEverywhereInputs',
    nodeCreated(node) {
      if (node.comfyClass !== 'KSampler') return
      const previous = node.getExtraMenuOptions
      node.getExtraMenuOptions = function (canvas, options) {
        previous?.apply(this, [canvas, options])
        options.push(null, {
          content: 'UE Connectable Inputs',
          has_submenu: true,
          callback: useEverywhereInputsSubmenu
        })
      }
    }
  })
}
