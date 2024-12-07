import type {
  Dictionary,
  IContextMenuValue,
  LinkNetwork,
  ISlotType,
  MethodNames,
  Point,
  LinkSegment,
  Positionable,
} from "./interfaces"
import type {
  ISerialisedGraph,
  Serialisable,
  SerialisableGraph,
  SerialisableReroute,
} from "./types/serialisation"
import { Reroute, RerouteId } from "./Reroute"
import { LGraphEventMode } from "./types/globalEnums"
import { LiteGraph } from "./litegraph"
import { LGraphCanvas } from "./LGraphCanvas"
import { LGraphGroup } from "./LGraphGroup"
import { type NodeId, LGraphNode } from "./LGraphNode"
import { type LinkId, LLink } from "./LLink"
import { MapProxyHandler } from "./MapProxyHandler"
import { isSortaInsideOctagon } from "./measure"
import { getAllNestedItems } from "./utils/collections"

interface IGraphInput {
  name: string
  type: string
  value?: unknown
}

export interface LGraphState {
  lastGroupId: number
  lastNodeId: number
  lastLinkId: number
  lastRerouteId: number
}

type ParamsArray<T extends Record<any, any>, K extends MethodNames<T>> =
 Parameters<T[K]>[1] extends undefined
   ? Parameters<T[K]> | Parameters<T[K]>[0]
   : Parameters<T[K]>

/** Configuration used by {@link LGraph} `config`. */
export interface LGraphConfig {
  /** @deprecated Legacy config - unused */
  align_to_grid?: any
  links_ontop?: any
}

/**
 * LGraph is the class that contain a full graph. We instantiate one and add nodes to it, and then we can run the execution loop.
 * supported callbacks:
 * + onNodeAdded: when a new node is added to the graph
 * + onNodeRemoved: when a node inside this graph is removed
 * + onNodeConnectionChange: some connection has changed in the graph (connected or disconnected)
 */
export class LGraph implements LinkNetwork, Serialisable<SerialisableGraph> {
  static serialisedSchemaVersion = 1 as const

  // default supported types
  static supported_types = ["number", "string", "boolean"]
  static STATUS_STOPPED = 1
  static STATUS_RUNNING = 2

  _version: number
  /** The backing store for links.  Keys are wrapped in String() */
  _links: Map<LinkId, LLink> = new Map()
  /**
   * Indexed property access is deprecated.
   * Backwards compatibility with a Proxy has been added, but will eventually be removed.
   *
   * Use {@link Map} methods:
   * ```
   * const linkId = 123
   * const link = graph.links.get(linkId)
   * // Deprecated: const link = graph.links[linkId]
   * ```
   */
  links: Map<LinkId, LLink> & Record<LinkId, LLink>
  list_of_graphcanvas: LGraphCanvas[] | null
  status: number

  state: LGraphState

  _nodes: LGraphNode[]
  _nodes_by_id: Record<NodeId, LGraphNode>
  _nodes_in_order: LGraphNode[]
  _nodes_executable: LGraphNode[] | null
  _groups: LGraphGroup[]
  iteration: number
  globaltime: number
  runningtime: number
  fixedtime: number
  fixedtime_lapse: number
  elapsed_time: number
  last_update_time: number
  starttime: number
  catch_errors: boolean
  execution_timer_id: number | null
  errors_in_execution: boolean
  execution_time: number
  _last_trigger_time?: number
  filter?: string
  _subgraph_node?: LGraphNode
  /** Must contain serialisable values, e.g. primitive types */
  config: LGraphConfig
  vars: Dictionary<unknown>
  nodes_executing: boolean[]
  nodes_actioning: (string | boolean)[]
  nodes_executedAction: string[]
  extra: Record<any, any>
  inputs: Dictionary<IGraphInput>
  outputs: Dictionary<IGraphInput>

  /** @returns Whether the graph has no items */
  get empty(): boolean {
    return this._nodes.length + this._groups.length + this.reroutes.size === 0
  }

  /** @returns All items on the canvas that can be selected */
  *positionableItems(): Generator<LGraphNode | LGraphGroup | Reroute> {
    for (const node of this._nodes) yield node
    for (const group of this._groups) yield group
    for (const reroute of this.reroutes.values()) yield reroute
    return
  }

  #reroutes = new Map<RerouteId, Reroute>()
  /** All reroutes in this graph. */
  public get reroutes(): Map<RerouteId, Reroute> {
    return this.#reroutes
  }

  public set reroutes(value: Map<RerouteId, Reroute>) {
    if (!value) throw new TypeError("Attempted to set LGraph.reroutes to a falsy value.")

    const reroutes = this.#reroutes
    if (value.size === 0) {
      reroutes.clear()
      return
    }

    for (const rerouteId of reroutes.keys()) {
      if (!value.has(rerouteId)) reroutes.delete(rerouteId)
    }
    for (const [id, reroute] of value) {
      reroutes.set(id, reroute)
    }
  }

  /** @deprecated See {@link state}.{@link LGraphState.lastNodeId lastNodeId} */
  get last_node_id() {
    return this.state.lastNodeId
  }

  set last_node_id(value) {
    this.state.lastNodeId = value
  }

  /** @deprecated See {@link state}.{@link LGraphState.lastLinkId lastLinkId} */
  get last_link_id() {
    return this.state.lastLinkId
  }

  set last_link_id(value) {
    this.state.lastLinkId = value
  }

  onInputsOutputsChange?(): void
  onInputAdded?(name: string, type: string): void
  onAfterStep?(): void
  onBeforeStep?(): void
  onPlayEvent?(): void
  onStopEvent?(): void
  onAfterExecute?(): void
  onExecuteStep?(): void
  onNodeAdded?(node: LGraphNode): void
  onNodeRemoved?(node: LGraphNode): void
  onTrigger?(action: string, param: unknown): void
  onInputRenamed?(old_name: string, name: string): void
  onInputTypeChanged?(name: string, type: string): void
  onInputRemoved?(name: string): void
  onOutputAdded?(name: string, type: string): void
  onOutputRenamed?(old_name: string, name: string): void
  onOutputTypeChanged?(name: string, type: string): void
  onOutputRemoved?(name: string): void
  onBeforeChange?(graph: LGraph, info?: LGraphNode): void
  onAfterChange?(graph: LGraph, info?: LGraphNode): void
  onConnectionChange?(node: LGraphNode): void
  on_change?(graph: LGraph): void
  onSerialize?(data: ISerialisedGraph | SerialisableGraph): void
  onConfigure?(data: ISerialisedGraph | SerialisableGraph): void
  onGetNodeMenuOptions?(options: IContextMenuValue[], node: LGraphNode): void
  onNodeConnectionChange?(
    nodeSlotType: ISlotType,
    targetNode: LGraphNode,
    slotIndex: number,
    sourceNode?: LGraphNode,
    sourceSlotIndex?: number,
  ): void

  private _input_nodes?: LGraphNode[]

  /**
   * See {@link LGraph}
   * @param o data from previous serialization [optional]
   */
  constructor(o?: ISerialisedGraph | SerialisableGraph) {
    if (LiteGraph.debug) console.log("Graph created")

    /** @see MapProxyHandler */
    const links = this._links
    MapProxyHandler.bindAllMethods(links)
    const handler = new MapProxyHandler<LLink>()
    this.links = new Proxy(links, handler) as Map<LinkId, LLink> & Record<LinkId, LLink>

    this.list_of_graphcanvas = null
    this.clear()

    if (o) this.configure(o)
  }

  // TODO: Remove
  // used to know which types of connections support this graph (some graphs do not allow certain types)
  getSupportedTypes(): string[] {
    // @ts-expect-error
    return this.supported_types || LGraph.supported_types
  }

  /**
   * Removes all nodes from this graph
   */
  clear(): void {
    this.stop()
    this.status = LGraph.STATUS_STOPPED

    this.state = {
      lastGroupId: 0,
      lastNodeId: 0,
      lastLinkId: 0,
      lastRerouteId: 0,
    }

    this._version = -1 // used to detect changes

    // safe clear
    if (this._nodes) {
      for (let i = 0; i < this._nodes.length; ++i) {
        this._nodes[i].onRemoved?.()
      }
    }

    // nodes
    this._nodes = []
    this._nodes_by_id = {}
    this._nodes_in_order = [] // nodes sorted in execution order
    this._nodes_executable = null // nodes that contain onExecute sorted in execution order

    this._links.clear()
    this.reroutes.clear()

    // other scene stuff
    this._groups = []

    // iterations
    this.iteration = 0

    // custom data
    this.config = {}
    this.vars = {}
    this.extra = {} // to store custom data

    // timing
    this.globaltime = 0
    this.runningtime = 0
    this.fixedtime = 0
    this.fixedtime_lapse = 0.01
    this.elapsed_time = 0.01
    this.last_update_time = 0
    this.starttime = 0

    this.catch_errors = true

    this.nodes_executing = []
    this.nodes_actioning = []
    this.nodes_executedAction = []

    // subgraph_data
    this.inputs = {}
    this.outputs = {}

    // notify canvas to redraw
    this.change()

    this.canvasAction(c => c.clear())
  }

  get nodes() {
    return this._nodes
  }

  get groups() {
    return this._groups
  }

  /**
   * Attach Canvas to this graph
   */
  attachCanvas(graphcanvas: LGraphCanvas): void {
    if (graphcanvas.constructor != LGraphCanvas)
      throw "attachCanvas expects a LGraphCanvas instance"
    if (graphcanvas.graph != this)
      graphcanvas.graph?.detachCanvas(graphcanvas)

    graphcanvas.graph = this

    this.list_of_graphcanvas ||= []
    this.list_of_graphcanvas.push(graphcanvas)
  }

  /**
   * Detach Canvas from this graph
   */
  detachCanvas(graphcanvas: LGraphCanvas): void {
    if (!this.list_of_graphcanvas) return

    const pos = this.list_of_graphcanvas.indexOf(graphcanvas)
    if (pos == -1) return

    graphcanvas.graph = null
    this.list_of_graphcanvas.splice(pos, 1)
  }

  /**
   * Starts running this graph every interval milliseconds.
   * @param interval amount of milliseconds between executions, if 0 then it renders to the monitor refresh rate
   */
  start(interval?: number): void {
    if (this.status == LGraph.STATUS_RUNNING) return
    this.status = LGraph.STATUS_RUNNING

    this.onPlayEvent?.()
    this.sendEventToAllNodes("onStart")

    // launch
    this.starttime = LiteGraph.getTime()
    this.last_update_time = this.starttime
    interval ||= 0
    const that = this

    // execute once per frame
    if (
      interval == 0 &&
      typeof window != "undefined" &&
      window.requestAnimationFrame
    ) {
      function on_frame() {
        if (that.execution_timer_id != -1) return

        window.requestAnimationFrame(on_frame)
        that.onBeforeStep?.()
        that.runStep(1, !that.catch_errors)
        that.onAfterStep?.()
      }
      this.execution_timer_id = -1
      on_frame()
    } else {
      // execute every 'interval' ms
      // @ts-expect-error
      this.execution_timer_id = setInterval(function () {
        // execute
        that.onBeforeStep?.()
        that.runStep(1, !that.catch_errors)
        that.onAfterStep?.()
      }, interval)
    }
  }

  /**
   * Stops the execution loop of the graph
   */
  stop(): void {
    if (this.status == LGraph.STATUS_STOPPED) return

    this.status = LGraph.STATUS_STOPPED

    this.onStopEvent?.()

    if (this.execution_timer_id != null) {
      if (this.execution_timer_id != -1) {
        clearInterval(this.execution_timer_id)
      }
      this.execution_timer_id = null
    }

    this.sendEventToAllNodes("onStop")
  }

  /**
   * Run N steps (cycles) of the graph
   * @param num number of steps to run, default is 1
   * @param do_not_catch_errors [optional] if you want to try/catch errors
   * @param limit max number of nodes to execute (used to execute from start to a node)
   */
  runStep(num: number, do_not_catch_errors: boolean, limit?: number): void {
    num = num || 1

    const start = LiteGraph.getTime()
    this.globaltime = 0.001 * (start - this.starttime)

    const nodes = this._nodes_executable
      ? this._nodes_executable
      : this._nodes
    if (!nodes) return

    limit = limit || nodes.length

    if (do_not_catch_errors) {
      // iterations
      for (let i = 0; i < num; i++) {
        for (let j = 0; j < limit; ++j) {
          const node = nodes[j]
          // FIXME: Looks like copy/paste broken logic - checks for "on", executes "do"
          if (node.mode == LGraphEventMode.ALWAYS && node.onExecute) {
            // wrap node.onExecute();
            node.doExecute?.()
          }
        }

        this.fixedtime += this.fixedtime_lapse
        this.onExecuteStep?.()
      }

      this.onAfterExecute?.()
    } else {
      try {
        // iterations
        for (let i = 0; i < num; i++) {
          for (let j = 0; j < limit; ++j) {
            const node = nodes[j]
            if (node.mode == LGraphEventMode.ALWAYS) {
              node.onExecute?.()
            }
          }

          this.fixedtime += this.fixedtime_lapse
          this.onExecuteStep?.()
        }

        this.onAfterExecute?.()
        this.errors_in_execution = false
      } catch (err) {
        this.errors_in_execution = true
        if (LiteGraph.throw_errors) throw err

        if (LiteGraph.debug) console.log("Error during execution: " + err)
        this.stop()
      }
    }

    const now = LiteGraph.getTime()
    let elapsed = now - start
    if (elapsed == 0) elapsed = 1

    this.execution_time = 0.001 * elapsed
    this.globaltime += 0.001 * elapsed
    this.iteration += 1
    this.elapsed_time = (now - this.last_update_time) * 0.001
    this.last_update_time = now
    this.nodes_executing = []
    this.nodes_actioning = []
    this.nodes_executedAction = []
  }

  /**
   * Updates the graph execution order according to relevance of the nodes (nodes with only outputs have more relevance than
   * nodes with only inputs.
   */
  updateExecutionOrder(): void {
    this._nodes_in_order = this.computeExecutionOrder(false)
    this._nodes_executable = []
    for (let i = 0; i < this._nodes_in_order.length; ++i) {
      if (this._nodes_in_order[i].onExecute) {
        this._nodes_executable.push(this._nodes_in_order[i])
      }
    }
  }

  // This is more internal, it computes the executable nodes in order and returns it
  computeExecutionOrder(
    only_onExecute: boolean,
    set_level?: boolean,
  ): LGraphNode[] {
    const L: LGraphNode[] = []
    const S: LGraphNode[] = []
    const M: Dictionary<LGraphNode> = {}
    const visited_links: Record<NodeId, boolean> = {} // to avoid repeating links
    const remaining_links: Record<NodeId, number> = {} // to a

    // search for the nodes without inputs (starting nodes)
    for (let i = 0, l = this._nodes.length; i < l; ++i) {
      const node = this._nodes[i]
      if (only_onExecute && !node.onExecute) {
        continue
      }

      M[node.id] = node // add to pending nodes

      let num = 0 // num of input connections
      if (node.inputs) {
        for (let j = 0, l2 = node.inputs.length; j < l2; j++) {
          if (node.inputs[j]?.link != null) {
            num += 1
          }
        }
      }

      if (num == 0) {
        // is a starting node
        S.push(node)
        if (set_level) node._level = 1
      } else {
        // num of input links
        if (set_level) node._level = 0
        remaining_links[node.id] = num
      }
    }

    while (true) {
      // get an starting node
      const node = S.shift()
      if (node === undefined) break

      L.push(node) // add to ordered list
      delete M[node.id] // remove from the pending nodes

      if (!node.outputs) continue

      // for every output
      for (let i = 0; i < node.outputs.length; i++) {
        const output = node.outputs[i]
        // not connected
        // TODO: Confirm functionality, clean condition
        if (output?.links == null || output.links.length == 0)
          continue

        // for every connection
        for (let j = 0; j < output.links.length; j++) {
          const link_id = output.links[j]
          const link = this._links.get(link_id)
          if (!link) continue

          // already visited link (ignore it)
          if (visited_links[link.id]) continue

          const target_node = this.getNodeById(link.target_id)
          if (target_node == null) {
            visited_links[link.id] = true
            continue
          }

          if (set_level && (!target_node._level || target_node._level <= node._level)) {
            target_node._level = node._level + 1
          }

          // mark as visited
          visited_links[link.id] = true
          // reduce the number of links remaining
          remaining_links[target_node.id] -= 1

          // if no more links, then add to starters array
          if (remaining_links[target_node.id] == 0) S.push(target_node)
        }
      }
    }

    // the remaining ones (loops)
    for (const i in M) {
      L.push(M[i])
    }

    if (L.length != this._nodes.length && LiteGraph.debug)
      console.warn("something went wrong, nodes missing")

    const l = L.length

    /** Ensure type is set */
    type OrderedLGraphNode = LGraphNode & { order: number }

    /** Sets the order property of each provided node to its index in {@link nodes}. */
    function setOrder(nodes: LGraphNode[]): asserts nodes is OrderedLGraphNode[] {
      const l = nodes.length
      for (let i = 0; i < l; ++i) {
        nodes[i].order = i
      }
    }

    // save order number in the node
    setOrder(L)

    // sort now by priority
    L.sort(function (A, B) {
      // @ts-expect-error ctor props
      const Ap = A.constructor.priority || A.priority || 0
      // @ts-expect-error ctor props
      const Bp = B.constructor.priority || B.priority || 0
      // if same priority, sort by order

      return Ap == Bp
        ? A.order - B.order
        : Ap - Bp
    })

    // save order number in the node, again...
    setOrder(L)

    return L
  }

  /**
   * Returns all the nodes that could affect this one (ancestors) by crawling all the inputs recursively.
   * It doesn't include the node itself
   * @returns an array with all the LGraphNodes that affect this node, in order of execution
   */
  getAncestors(node: LGraphNode): LGraphNode[] {
    const ancestors: LGraphNode[] = []
    const pending = [node]
    const visited: Dictionary<boolean> = {}

    while (pending.length) {
      const current = pending.shift()
      if (!current?.inputs) continue

      if (!visited[current.id] && current != node) {
        visited[current.id] = true
        ancestors.push(current)
      }

      for (let i = 0; i < current.inputs.length; ++i) {
        const input = current.getInputNode(i)
        if (input && ancestors.indexOf(input) == -1) {
          pending.push(input)
        }
      }
    }

    ancestors.sort(function (a, b) {
      return a.order - b.order
    })
    return ancestors
  }

  /**
   * Positions every node in a more readable manner
   */
  arrange(margin?: number, layout?: string): void {
    margin = margin || 100

    const nodes = this.computeExecutionOrder(false, true)
    const columns: LGraphNode[][] = []
    for (let i = 0; i < nodes.length; ++i) {
      const node = nodes[i]
      const col = node._level || 1
      columns[col] ||= []
      columns[col].push(node)
    }

    let x = margin

    for (let i = 0; i < columns.length; ++i) {
      const column = columns[i]
      if (!column) continue

      let max_size = 100
      let y = margin + LiteGraph.NODE_TITLE_HEIGHT
      for (let j = 0; j < column.length; ++j) {
        const node = column[j]
        node.pos[0] = layout == LiteGraph.VERTICAL_LAYOUT ? y : x
        node.pos[1] = layout == LiteGraph.VERTICAL_LAYOUT ? x : y
        const max_size_index = layout == LiteGraph.VERTICAL_LAYOUT ? 1 : 0
        if (node.size[max_size_index] > max_size) {
          max_size = node.size[max_size_index]
        }
        const node_size_index = layout == LiteGraph.VERTICAL_LAYOUT ? 0 : 1
        y += node.size[node_size_index] + margin + LiteGraph.NODE_TITLE_HEIGHT
      }
      x += max_size + margin
    }

    this.setDirtyCanvas(true, true)
  }

  /**
   * Returns the amount of time the graph has been running in milliseconds
   * @returns number of milliseconds the graph has been running
   */
  getTime(): number {
    return this.globaltime
  }

  /**
   * Returns the amount of time accumulated using the fixedtime_lapse var.
   * This is used in context where the time increments should be constant
   * @returns number of milliseconds the graph has been running
   */
  getFixedTime(): number {
    return this.fixedtime
  }

  /**
   * Returns the amount of time it took to compute the latest iteration.
   * Take into account that this number could be not correct
   * if the nodes are using graphical actions
   * @returns number of milliseconds it took the last cycle
   */
  getElapsedTime(): number {
    return this.elapsed_time
  }

  /**
   * Sends an event to all the nodes, useful to trigger stuff
   * @param eventname the name of the event (function to be called)
   * @param params parameters in array format
   */
  sendEventToAllNodes(
    eventname: string,
    params?: object | object[],
    mode?: LGraphEventMode,
  ): void {
    mode = mode || LGraphEventMode.ALWAYS

    const nodes = this._nodes_in_order ? this._nodes_in_order : this._nodes
    if (!nodes) return

    for (let j = 0, l = nodes.length; j < l; ++j) {
      const node = nodes[j]

      // @ts-expect-error
      if (node.constructor === LiteGraph.Subgraph && eventname != "onExecute") {
        if (node.mode == mode) {
          // @ts-expect-error Subgraph - not currently in use
          node.sendEventToAllNodes(eventname, params, mode)
        }
        continue
      }

      if (!node[eventname] || node.mode != mode) continue
      if (params === undefined) {
        node[eventname]()
      } else if (params && params.constructor === Array) {
        node[eventname].apply(node, params)
      } else {
        node[eventname](params)
      }
    }
  }

  /**
   * Runs an action on every canvas registered to this graph.
   * @param action Action to run for every canvas
   */
  canvasAction(action: (canvas: LGraphCanvas) => void): void {
    this.list_of_graphcanvas?.forEach(action)
  }

  /** @deprecated See {@link LGraph.canvasAction} */
  sendActionToCanvas<T extends MethodNames<LGraphCanvas>>(
    action: T,
    params?: ParamsArray<LGraphCanvas, T>,
  ): void {
    if (!this.list_of_graphcanvas) return

    for (let i = 0; i < this.list_of_graphcanvas.length; ++i) {
      const c = this.list_of_graphcanvas[i]
      c[action]?.apply(c, params)
    }
  }

  /**
   * Adds a new node instance to this graph
   * @param node the instance of the node
   */
  add(
    node: LGraphNode | LGraphGroup,
    skip_compute_order?: boolean,
  ): LGraphNode | null | undefined {
    if (!node) return
    const { state } = this

    // Ensure created items are snapped
    if (LiteGraph.alwaysSnapToGrid) {
      const snapTo = this.getSnapToGridSize()
      if (snapTo) node.snapToGrid(snapTo)
    }

    // LEGACY: This was changed from constructor === LGraphGroup
    // groups
    if (node instanceof LGraphGroup) {
      // Assign group ID
      if (node.id == null || node.id === -1) node.id = ++state.lastGroupId
      if (node.id > state.lastGroupId) state.lastGroupId = node.id

      this._groups.push(node)
      this.setDirtyCanvas(true)
      this.change()
      node.graph = this
      this._version++
      return
    }

    // nodes
    if (node.id != -1 && this._nodes_by_id[node.id] != null) {
      console.warn(
        "LiteGraph: there is already a node with this ID, changing it",
      )
      node.id = LiteGraph.use_uuids
        ? LiteGraph.uuidv4()
        : ++state.lastNodeId
    }

    if (this._nodes.length >= LiteGraph.MAX_NUMBER_OF_NODES) {
      throw "LiteGraph: max number of nodes in a graph reached"
    }

    // give him an id
    if (LiteGraph.use_uuids) {
      if (node.id == null || node.id == -1)
        node.id = LiteGraph.uuidv4()
    } else {
      if (node.id == null || node.id == -1) {
        node.id = ++state.lastNodeId
      } else if (typeof node.id === "number" && state.lastNodeId < node.id) {
        state.lastNodeId = node.id
      }
    }

    node.graph = this
    this._version++

    this._nodes.push(node)
    this._nodes_by_id[node.id] = node

    node.onAdded?.(this)

    if (this.config.align_to_grid) node.alignToGrid()

    if (!skip_compute_order) this.updateExecutionOrder()

    this.onNodeAdded?.(node)

    this.setDirtyCanvas(true)
    this.change()

    return node // to chain actions
  }

  /**
   * Removes a node from the graph
   * @param node the instance of the node
   */
  remove(node: LGraphNode | LGraphGroup): void {
    // LEGACY: This was changed from constructor === LiteGraph.LGraphGroup
    if (node instanceof LGraphGroup) {
      const index = this._groups.indexOf(node)
      if (index != -1) {
        this._groups.splice(index, 1)
      }
      node.graph = null
      this._version++
      this.setDirtyCanvas(true, true)
      this.change()
      return
    }

    // not found
    if (this._nodes_by_id[node.id] == null) return
    // cannot be removed
    if (node.ignore_remove) return

    this.beforeChange() // sure? - almost sure is wrong

    // disconnect inputs
    if (node.inputs) {
      for (let i = 0; i < node.inputs.length; i++) {
        const slot = node.inputs[i]
        if (slot.link != null) node.disconnectInput(i)
      }
    }

    // disconnect outputs
    if (node.outputs) {
      for (let i = 0; i < node.outputs.length; i++) {
        const slot = node.outputs[i]
        if (slot.links?.length) node.disconnectOutput(i)
      }
    }

    // callback
    node.onRemoved?.()

    node.graph = null
    this._version++

    // remove from canvas render
    if (this.list_of_graphcanvas) {
      for (let i = 0; i < this.list_of_graphcanvas.length; ++i) {
        const canvas = this.list_of_graphcanvas[i]
        if (canvas.selected_nodes[node.id])
          delete canvas.selected_nodes[node.id]
      }
    }

    // remove from containers
    const pos = this._nodes.indexOf(node)
    if (pos != -1) this._nodes.splice(pos, 1)

    delete this._nodes_by_id[node.id]

    this.onNodeRemoved?.(node)

    // close panels
    this.canvasAction(c => c.checkPanels())

    this.setDirtyCanvas(true, true)
    this.afterChange() // sure? - almost sure is wrong
    this.change()

    this.updateExecutionOrder()
  }

  /**
   * Returns a node by its id.
   */
  getNodeById(id: NodeId): LGraphNode | null {
    return id != null
      ? this._nodes_by_id[id]
      : null
  }

  /**
   * Returns a list of nodes that matches a class
   * @param classObject the class itself (not an string)
   * @returns a list with all the nodes of this type
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  findNodesByClass(classObject: Function, result?: LGraphNode[]): LGraphNode[] {
    result = result || []
    result.length = 0
    for (let i = 0, l = this._nodes.length; i < l; ++i) {
      if (this._nodes[i].constructor === classObject)
        result.push(this._nodes[i])
    }
    return result
  }

  /**
   * Returns a list of nodes that matches a type
   * @param type the name of the node type
   * @returns a list with all the nodes of this type
   */
  findNodesByType(type: string, result: LGraphNode[]): LGraphNode[] {
    const matchType = type.toLowerCase()
    result = result || []
    result.length = 0
    for (let i = 0, l = this._nodes.length; i < l; ++i) {
      if (this._nodes[i].type?.toLowerCase() == matchType)
        result.push(this._nodes[i])
    }
    return result
  }

  /**
   * Returns the first node that matches a name in its title
   * @param title the name of the node to search
   * @returns the node or null
   */
  findNodeByTitle(title: string): LGraphNode | null {
    for (let i = 0, l = this._nodes.length; i < l; ++i) {
      if (this._nodes[i].title == title)
        return this._nodes[i]
    }
    return null
  }

  /**
   * Returns a list of nodes that matches a name
   * @param title the name of the node to search
   * @returns a list with all the nodes with this name
   */
  findNodesByTitle(title: string): LGraphNode[] {
    const result: LGraphNode[] = []
    for (let i = 0, l = this._nodes.length; i < l; ++i) {
      if (this._nodes[i].title == title)
        result.push(this._nodes[i])
    }
    return result
  }

  /**
   * Returns the top-most node in this position of the canvas
   * @param x the x coordinate in canvas space
   * @param y the y coordinate in canvas space
   * @param nodeList a list with all the nodes to search from, by default is all the nodes in the graph
   * @returns the node at this position or null
   */
  getNodeOnPos(
    x: number,
    y: number,
    nodeList?: LGraphNode[],
  ): LGraphNode | null {
    const nodes = nodeList || this._nodes
    let i = nodes.length
    while (--i >= 0) {
      const node = nodes[i]
      if (node.isPointInside(x, y)) return node
    }
    return null
  }

  /**
   * Returns the top-most group in that position
   * @param x The x coordinate in canvas space
   * @param y The y coordinate in canvas space
   * @returns The group or null
   */
  getGroupOnPos(x: number, y: number): LGraphGroup | undefined {
    return this._groups.toReversed().find(g => g.isPointInside(x, y))
  }

  /**
   * Returns the top-most group with a titlebar in the provided position.
   * @param x The x coordinate in canvas space
   * @param y The y coordinate in canvas space
   * @returns The group or null
   */
  getGroupTitlebarOnPos(x: number, y: number): LGraphGroup | undefined {
    return this._groups.toReversed().find(g => g.isPointInTitlebar(x, y))
  }

  /**
   * Finds a reroute a the given graph point
   * @param x X co-ordinate in graph space
   * @param y Y co-ordinate in graph space
   * @returns The first reroute under the given co-ordinates, or undefined
   */
  getRerouteOnPos(x: number, y: number): Reroute | undefined {
    for (const reroute of this.reroutes.values()) {
      const pos = reroute.pos

      if (isSortaInsideOctagon(x - pos[0], y - pos[1], 20))
        return reroute
    }
  }

  /**
   * Snaps the provided items to a grid.
   *
   * Item positions are reounded to the nearest multiple of {@link LiteGraph.CANVAS_GRID_SIZE}.
   *
   * When {@link LiteGraph.alwaysSnapToGrid} is enabled
   * and the grid size is falsy, a default of 1 is used.
   * @param items The items to be snapped to the grid
   * @todo Currently only snaps nodes.
   */
  snapToGrid(items: Set<Positionable>): void {
    const snapTo = this.getSnapToGridSize()
    if (!snapTo) return

    getAllNestedItems(items).forEach((item) => {
      if (!item.pinned) item.snapToGrid(snapTo)
    })
  }

  /**
   * Finds the size of the grid that items should be snapped to when moved.
   * @returns The size of the grid that items should be snapped to
   */
  getSnapToGridSize(): number {
    // Default to 1 when always snapping
    return LiteGraph.alwaysSnapToGrid
      ? LiteGraph.CANVAS_GRID_SIZE || 1
      : LiteGraph.CANVAS_GRID_SIZE
  }

  /**
   * Checks that the node type matches the node type registered,
   * used when replacing a nodetype by a newer version during execution
   * this replaces the ones using the old version with the new version
   */
  checkNodeTypes() {
    for (let i = 0; i < this._nodes.length; i++) {
      const node = this._nodes[i]
      const ctor = LiteGraph.registered_node_types[node.type]
      if (node.constructor == ctor) continue

      console.log("node being replaced by newer version: " + node.type)
      const newnode = LiteGraph.createNode(node.type)
      this._nodes[i] = newnode
      newnode.configure(node.serialize())
      newnode.graph = this
      this._nodes_by_id[newnode.id] = newnode

      if (node.inputs) newnode.inputs = node.inputs.concat()
      if (node.outputs) newnode.outputs = node.outputs.concat()
    }
    this.updateExecutionOrder()
  }

  // ********** GLOBALS *****************
  onAction(
    action: string,
    param: unknown,
    options: { action_call?: string },
  ): void {
    this._input_nodes = this.findNodesByClass(
      // @ts-expect-error Never impl.
      LiteGraph.GraphInput,
      this._input_nodes,
    )
    for (let i = 0; i < this._input_nodes.length; ++i) {
      const node = this._input_nodes[i]
      if (node.properties.name != action) continue

      // wrap node.onAction(action, param);
      node.actionDo(action, param, options)
      break
    }
  }

  trigger(action: string, param: unknown) {
    this.onTrigger?.(action, param)
  }

  /**
   * Tell this graph it has a global graph input of this type
   */
  addInput(name: string, type: string, value?: unknown): void {
    const input = this.inputs[name]
    // already exist
    if (input) return

    this.beforeChange()
    this.inputs[name] = { name: name, type: type, value: value }
    this._version++
    this.afterChange()

    this.onInputAdded?.(name, type)
    this.onInputsOutputsChange?.()
  }

  /**
   * Assign a data to the global graph input
   */
  setInputData(name: string, data: unknown): void {
    const input = this.inputs[name]
    if (!input) return
    input.value = data
  }

  /**
   * Returns the current value of a global graph input
   */
  getInputData(name: string): unknown {
    const input = this.inputs[name]
    return input
      ? input.value
      : null
  }

  /**
   * Changes the name of a global graph input
   */
  renameInput(old_name: string, name: string): boolean | undefined {
    if (name == old_name) return

    if (!this.inputs[old_name]) return false

    if (this.inputs[name]) {
      console.error("there is already one input with that name")
      return false
    }

    this.inputs[name] = this.inputs[old_name]
    delete this.inputs[old_name]
    this._version++

    this.onInputRenamed?.(old_name, name)
    this.onInputsOutputsChange?.()
  }

  /**
   * Changes the type of a global graph input
   */
  changeInputType(name: string, type: string): boolean | undefined {
    if (!this.inputs[name]) return false

    if (
      this.inputs[name].type &&
      String(this.inputs[name].type).toLowerCase() == String(type).toLowerCase()
    ) {
      return
    }

    this.inputs[name].type = type
    this._version++
    this.onInputTypeChanged?.(name, type)
  }

  /**
   * Removes a global graph input
   */
  removeInput(name: string): boolean {
    if (!this.inputs[name]) return false

    delete this.inputs[name]
    this._version++

    this.onInputRemoved?.(name)
    this.onInputsOutputsChange?.()
    return true
  }

  /**
   * Creates a global graph output
   */
  addOutput(name: string, type: string, value: unknown): void {
    this.outputs[name] = { name: name, type: type, value: value }
    this._version++

    this.onOutputAdded?.(name, type)

    this.onInputsOutputsChange?.()
  }

  /**
   * Assign a data to the global output
   */
  setOutputData(name: string, value: unknown): void {
    const output = this.outputs[name]
    if (!output) return
    output.value = value
  }

  /**
   * Returns the current value of a global graph output
   */
  getOutputData(name: string): unknown {
    const output = this.outputs[name]
    if (!output) return null
    return output.value
  }

  /**
   * Renames a global graph output
   */
  renameOutput(old_name: string, name: string): boolean | undefined {
    if (!this.outputs[old_name]) return false

    if (this.outputs[name]) {
      console.error("there is already one output with that name")
      return false
    }

    this.outputs[name] = this.outputs[old_name]
    delete this.outputs[old_name]
    this._version++

    this.onOutputRenamed?.(old_name, name)

    this.onInputsOutputsChange?.()
  }

  /**
   * Changes the type of a global graph output
   */
  changeOutputType(name: string, type: string): boolean | undefined {
    if (!this.outputs[name]) return false

    if (
      this.outputs[name].type &&
      String(this.outputs[name].type).toLowerCase() == String(type).toLowerCase()
    ) {
      return
    }

    this.outputs[name].type = type
    this._version++
    this.onOutputTypeChanged?.(name, type)
  }

  /**
   * Removes a global graph output
   */
  removeOutput(name: string): boolean {
    if (!this.outputs[name]) return false

    delete this.outputs[name]
    this._version++

    this.onOutputRemoved?.(name)

    this.onInputsOutputsChange?.()
    return true
  }

  /** @todo Clean up - never implemented. */
  triggerInput(name: string, value: any): void {
    const nodes = this.findNodesByTitle(name)
    for (let i = 0; i < nodes.length; ++i) {
      // @ts-expect-error
      nodes[i].onTrigger(value)
    }
  }

  /** @todo Clean up - never implemented. */
  setCallback(name: string, func: any): void {
    const nodes = this.findNodesByTitle(name)
    for (let i = 0; i < nodes.length; ++i) {
      // @ts-expect-error
      nodes[i].setTrigger(func)
    }
  }

  // used for undo, called before any change is made to the graph
  beforeChange(info?: LGraphNode): void {
    this.onBeforeChange?.(this, info)
    this.canvasAction(c => c.onBeforeChange?.(this))
  }

  // used to resend actions, called after any change is made to the graph
  afterChange(info?: LGraphNode): void {
    this.onAfterChange?.(this, info)
    this.canvasAction(c => c.onAfterChange?.(this))
  }

  connectionChange(node: LGraphNode): void {
    this.updateExecutionOrder()
    this.onConnectionChange?.(node)
    this._version++
    // TODO: Interface never implemented - any consumers?
    // @ts-expect-error
    this.canvasAction(c => c.onConnectionChange?.())
  }

  /**
   * clears the triggered slot animation in all links (stop visual animation)
   */
  clearTriggeredSlots(): void {
    for (const link_info of this._links.values()) {
      if (!link_info) continue

      if (link_info._last_time) link_info._last_time = 0
    }
  }

  /* Called when something visually changed (not the graph!) */
  change(): void {
    if (LiteGraph.debug) {
      console.log("Graph changed")
    }
    this.canvasAction(c => c.setDirty(true, true))
    this.on_change?.(this)
  }

  setDirtyCanvas(fg: boolean, bg?: boolean): void {
    this.canvasAction(c => c.setDirty(fg, bg))
  }

  /**
   * Configures a reroute on the graph where ID is already known (probably deserialisation).
   * Creates the object if it does not exist.
   * @param serialisedReroute See {@link SerialisableReroute}
   */
  setReroute({ id, parentId, pos, linkIds }: SerialisableReroute): Reroute {
    id ??= ++this.state.lastRerouteId
    if (id > this.state.lastRerouteId) this.state.lastRerouteId = id

    const reroute = this.reroutes.get(id) ?? new Reroute(id, this)
    reroute.update(parentId, pos, linkIds)
    this.reroutes.set(id, reroute)
    return reroute
  }

  /**
   * Creates a new reroute and adds it to the graph.
   * @param pos Position in graph space
   * @param before The existing link segment (reroute, link) that will be after this reroute,
   * going from the node output to input.
   * @returns The newly created reroute - typically ignored.
   */
  createReroute(pos: Point, before: LinkSegment): Reroute {
    const rerouteId = ++this.state.lastRerouteId
    const linkIds = before instanceof Reroute
      ? before.linkIds
      : [before.id]
    const reroute = new Reroute(rerouteId, this, pos, before.parentId, linkIds)
    this.reroutes.set(rerouteId, reroute)
    for (const linkId of linkIds) {
      const link = this._links.get(linkId)
      if (!link) continue
      if (link.parentId === before.parentId) link.parentId = rerouteId
      LLink.getReroutes(this, link)
        ?.filter(x => x.parentId === before.parentId)
        .forEach(x => x.parentId = rerouteId)
    }

    return reroute
  }

  /**
   * Removes a reroute from the graph
   * @param id ID of reroute to remove
   */
  removeReroute(id: RerouteId): void {
    const { reroutes } = this
    const reroute = reroutes.get(id)
    if (!reroute) return

    // Extract reroute from the reroute chain
    const { parentId, linkIds } = reroute
    for (const reroute of reroutes.values()) {
      if (reroute.parentId === id) reroute.parentId = parentId
    }

    for (const linkId of linkIds) {
      const link = this._links.get(linkId)
      if (link && link.parentId === id) link.parentId = parentId
    }

    reroutes.delete(id)
    this.setDirtyCanvas(false, true)
  }

  /**
   * Destroys a link
   */
  removeLink(link_id: LinkId): void {
    const link = this._links.get(link_id)
    if (!link) return

    const node = this.getNodeById(link.target_id)
    node?.disconnectInput(link.target_slot)

    link.disconnect(this)
  }

  /**
   * Creates a Object containing all the info about this graph, it can be serialized
   * @deprecated Use {@link asSerialisable}, which returns the newer schema version.
   * @returns value of the node
   */
  serialize(option?: { sortNodes: boolean }): ISerialisedGraph {
    const { config, state, groups, nodes, reroutes, extra } = this.asSerialisable(option)
    const linkArray = [...this._links.values()]
    const links = linkArray.map(x => x.serialize())

    if (reroutes.length) {
      extra.reroutes = reroutes

      // Link parent IDs cannot go in 0.4 schema arrays
      extra.linkExtensions = linkArray
        .filter(x => x.parentId !== undefined)
        .map(x => ({ id: x.id, parentId: x.parentId }))
    }
    return {
      last_node_id: state.lastNodeId,
      last_link_id: state.lastLinkId,
      nodes,
      links,
      groups,
      config,
      extra,
      version: LiteGraph.VERSION,
    }
  }

  /**
   * Prepares a shallow copy of this object for immediate serialisation or structuredCloning.
   * The return value should be discarded immediately.
   * @param options Serialise options = currently `sortNodes: boolean`, whether to sort nodes by ID.
   * @returns A shallow copy of parts of this graph, with shallow copies of its serialisable objects.
   * Mutating the properties of the return object may result in changes to your graph.
   * It is intended for use with {@link structuredClone} or {@link JSON.stringify}.
   */
  asSerialisable(options?: { sortNodes: boolean }): SerialisableGraph {
    const { config, state, extra } = this

    const nodeList = !LiteGraph.use_uuids && options?.sortNodes
      // @ts-expect-error If LiteGraph.use_uuids is false, ids are numbers.
      ? [...this._nodes].sort((a, b) => a.id - b.id)
      : this._nodes

    const nodes = nodeList.map(node => node.serialize())
    const groups = this._groups.map(x => x.serialize())

    const links = [...this._links.values()].map(x => x.asSerialisable())
    const reroutes = [...this.reroutes.values()].map(x => x.asSerialisable())

    const data: SerialisableGraph = {
      version: LGraph.serialisedSchemaVersion,
      config,
      state,
      groups,
      nodes,
      links,
      reroutes,
      extra,
    }

    this.onSerialize?.(data)
    return data
  }

  /**
   * Configure a graph from a JSON string
   * @param data The deserialised object to configure this graph from
   * @param keep_old If `true`, the graph will not be cleared prior to
   * adding the configuration.
   */
  configure(
    data: ISerialisedGraph | SerialisableGraph,
    keep_old?: boolean,
  ): boolean | undefined {
    // TODO: Finish typing configure()
    if (!data) return
    if (!keep_old) this.clear()

    const { extra } = data
    let reroutes: SerialisableReroute[] | undefined

    // TODO: Determine whether this should this fall back to 0.4.
    if (data.version === 0.4) {
      // Deprecated - old schema version, links are arrays
      if (Array.isArray(data.links)) {
        for (const linkData of data.links) {
          const link = LLink.createFromArray(linkData)
          this._links.set(link.id, link)
        }
      }
      // #region `extra` embeds for v0.4

      // LLink parentIds
      if (Array.isArray(extra?.linkExtensions)) {
        for (const linkEx of extra.linkExtensions) {
          const link = this._links.get(linkEx.id)
          if (link) link.parentId = linkEx.parentId
        }
      }

      // Reroutes
      reroutes = extra?.reroutes

      // #endregion `extra` embeds for v0.4
    } else {
      // New schema - one version so far, no check required.

      // State
      if (data.state) {
        const { state: { lastGroupId, lastLinkId, lastNodeId, lastRerouteId } } = data
        if (lastGroupId != null) this.state.lastGroupId = lastGroupId
        if (lastLinkId != null) this.state.lastLinkId = lastLinkId
        if (lastNodeId != null) this.state.lastNodeId = lastNodeId
        if (lastRerouteId != null) this.state.lastRerouteId = lastRerouteId
      }

      // Links
      if (Array.isArray(data.links)) {
        for (const linkData of data.links) {
          const link = LLink.create(linkData)
          this._links.set(link.id, link)
        }
      }

      reroutes = data.reroutes
    }

    // Reroutes
    if (Array.isArray(reroutes)) {
      for (const rerouteData of reroutes) {
        const reroute = this.setReroute(rerouteData)

        // Drop broken links, and ignore reroutes with no valid links
        if (!reroute.validateLinks(this._links))
          this.reroutes.delete(rerouteData.id)
      }
    }

    const nodesData = data.nodes

    // copy all stored fields
    for (const i in data) {
      // links must be accepted
      if (
        i == "nodes" ||
        i == "groups" ||
        i == "links" ||
        i === "state" ||
        i === "reroutes"
      )
        continue
      this[i] = data[i]
    }

    let error = false

    // create nodes
    this._nodes = []
    if (nodesData) {
      for (let i = 0, l = nodesData.length; i < l; ++i) {
        const n_info = nodesData[i] // stored info
        let node = LiteGraph.createNode(n_info.type, n_info.title)
        if (!node) {
          if (LiteGraph.debug) console.log("Node not found or has errors: " + n_info.type)

          // in case of error we create a replacement node to avoid losing info
          node = new LGraphNode(undefined)
          node.last_serialization = n_info
          node.has_errors = true
          error = true
          // continue;
        }

        node.id = n_info.id // id it or it will create a new id
        this.add(node, true) // add before configure, otherwise configure cannot create links
      }

      // configure nodes afterwards so they can reach each other
      for (let i = 0, l = nodesData.length; i < l; ++i) {
        const n_info = nodesData[i]
        const node = this.getNodeById(n_info.id)
        node?.configure(n_info)
      }
    }

    // groups
    this._groups.length = 0
    if (data.groups) {
      for (let i = 0; i < data.groups.length; ++i) {
        // TODO: Search/remove these global object refs
        const group = new LiteGraph.LGraphGroup()
        group.configure(data.groups[i])
        this.add(group)
      }
    }

    this.updateExecutionOrder()

    this.extra = data.extra || {}

    this.onConfigure?.(data)
    this._version++
    this.setDirtyCanvas(true, true)
    return error
  }

  load(url: string | Blob | URL | File, callback: () => void) {
    const that = this

    // LEGACY: This was changed from constructor === File/Blob
    // from file
    if (url instanceof Blob || url instanceof File) {
      const reader = new FileReader()
      reader.addEventListener("load", function (event) {
        const data = JSON.parse(event.target.result.toString())
        that.configure(data)
        callback?.()
      })

      reader.readAsText(url)
      return
    }

    // is a string, then an URL
    const req = new XMLHttpRequest()
    req.open("GET", url, true)
    req.send(null)
    req.onload = function () {
      if (req.status !== 200) {
        console.error("Error loading graph:", req.status, req.response)
        return
      }
      const data = JSON.parse(req.response)
      that.configure(data)
      callback?.()
    }
    req.onerror = function (err) {
      console.error("Error loading graph:", err)
    }
  }

  onNodeTrace(node?: LGraphNode, msg?: string) {
    // TODO
  }
}
