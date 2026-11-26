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
}
