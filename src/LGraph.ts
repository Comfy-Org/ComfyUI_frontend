import type { Dictionary, IContextMenuValue, ISlotType, MethodNames, Point } from "./interfaces"
import type { ISerialisedGraph } from "@/types/serialisation"
import type { LGraphEventMode } from "./types/globalEnums"
import { LiteGraph } from "./litegraph"
import { LGraphCanvas } from "./LGraphCanvas"
import { LGraphGroup } from "./LGraphGroup"
import { type NodeId, LGraphNode } from "./LGraphNode"
import { type LinkId, LLink, SerialisedLLinkArray } from "./LLink"

interface IGraphInput {
    name: string
    type: string
    value?: unknown
}

type ParamsArray<T extends Record<any, any>, K extends MethodNames<T>> = Parameters<T[K]>[1] extends undefined ? Parameters<T[K]> | Parameters<T[K]>[0] : Parameters<T[K]>

/**
 * LGraph is the class that contain a full graph. We instantiate one and add nodes to it, and then we can run the execution loop.
 * supported callbacks:
    + onNodeAdded: when a new node is added to the graph
    + onNodeRemoved: when a node inside this graph is removed
    + onNodeConnectionChange: some connection has changed in the graph (connected or disconnected)
 *
 * @class LGraph
 * @constructor
 * @param {Object} o data from previous serialization [optional]
 */

export class LGraph {
    //default supported types
    static supported_types = ["number", "string", "boolean"]
    static STATUS_STOPPED = 1
    static STATUS_RUNNING = 2

    _version: number
    links: Record<LinkId, LLink>
    list_of_graphcanvas?: LGraphCanvas[]
    status: number
    last_node_id: number
    last_link_id: number
    /** The largest ID created by this graph */
    last_reroute_id: number
    _nodes: LGraphNode[]
    _nodes_by_id: Record<NodeId, LGraphNode>
    _nodes_in_order: LGraphNode[]
    _nodes_executable: LGraphNode[]
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
    execution_timer_id: number
    errors_in_execution: boolean
    execution_time: number
    _last_trigger_time?: number
    filter?: string
    _subgraph_node?: LGraphNode
    config: { align_to_grid?: any; links_ontop?: any }
    vars: Dictionary<unknown>
    nodes_executing: boolean[]
    nodes_actioning: (string | boolean)[]
    nodes_executedAction: string[]
    extra: Record<any, any>
    inputs: Dictionary<IGraphInput>
    outputs: Dictionary<IGraphInput>
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
    onBeforeChange?(graph: LGraph, info: LGraphNode): void
    onAfterChange?(graph: LGraph, info: LGraphNode): void
    onConnectionChange?(node: LGraphNode): void
    on_change?(graph: LGraph): void
    onSerialize?(data: ISerialisedGraph): void
    onConfigure?(data: ISerialisedGraph): void
    onGetNodeMenuOptions?(options: IContextMenuValue[], node: LGraphNode): void

    private _input_nodes?: LGraphNode[]

    constructor(o?: ISerialisedGraph) {
        if (LiteGraph.debug) console.log("Graph created")

        this.list_of_graphcanvas = null
        this.clear()

        if (o) this.configure(o)
    }
    // TODO: Remove
    //used to know which types of connections support this graph (some graphs do not allow certain types)
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

        this.last_node_id = 0
        this.last_link_id = 0

        this._version = -1 //used to detect changes

        //safe clear
        if (this._nodes) {
            for (let i = 0; i < this._nodes.length; ++i) {
                this._nodes[i].onRemoved?.()
            }
        }

        //nodes
        this._nodes = []
        this._nodes_by_id = {}
        this._nodes_in_order = [] //nodes sorted in execution order
        this._nodes_executable = null //nodes that contain onExecute sorted in execution order

        //other scene stuff
        this._groups = []

        //links
        this.links = {} //container with all the links

        //iterations
        this.iteration = 0

        //custom data
        this.config = {}
        this.vars = {}
        this.extra = {} //to store custom data

        //timing
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

        //subgraph_data
        this.inputs = {}
        this.outputs = {}

        //notify canvas to redraw
        this.change()

        this.sendActionToCanvas("clear")
    }

    get nodes() {
        return this._nodes
    }

    get groups() {
        return this._groups
    }

    /**
     * Attach Canvas to this graph
     * @param {GraphCanvas} graph_canvas
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
     * @param {GraphCanvas} graph_canvas
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
     * @param {number} interval amount of milliseconds between executions, if 0 then it renders to the monitor refresh rate
     */
    start(interval?: number): void {
        if (this.status == LGraph.STATUS_RUNNING) return
        this.status = LGraph.STATUS_RUNNING

        this.onPlayEvent?.()
        this.sendEventToAllNodes("onStart")

        //launch
        this.starttime = LiteGraph.getTime()
        this.last_update_time = this.starttime
        interval ||= 0
        const that = this

        //execute once per frame
        if (interval == 0 && typeof window != "undefined" && window.requestAnimationFrame) {
            function on_frame() {
                if (that.execution_timer_id != -1) return

                window.requestAnimationFrame(on_frame)
                that.onBeforeStep?.()
                that.runStep(1, !that.catch_errors)
                that.onAfterStep?.()
            }
            this.execution_timer_id = -1
            on_frame()
        } else { //execute every 'interval' ms
            // @ts-expect-error
            this.execution_timer_id = setInterval(function () {
                //execute
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
     * @param {number} num number of steps to run, default is 1
     * @param {Boolean} do_not_catch_errors [optional] if you want to try/catch errors
     * @param {number} limit max number of nodes to execute (used to execute from start to a node)
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
            //iterations
            for (let i = 0; i < num; i++) {
                for (let j = 0; j < limit; ++j) {
                    const node = nodes[j]
                    // FIXME: Looks like copy/paste broken logic - checks for "on", executes "do"
                    if (node.mode == LiteGraph.ALWAYS && node.onExecute) {
                        //wrap node.onExecute();
                        node.doExecute?.()
                    }
                }

                this.fixedtime += this.fixedtime_lapse
                this.onExecuteStep?.()
            }

            this.onAfterExecute?.()
        } else {
            try {
                //iterations
                for (let i = 0; i < num; i++) {
                    for (let j = 0; j < limit; ++j) {
                        const node = nodes[j]
                        if (node.mode == LiteGraph.ALWAYS) {
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
    //This is more internal, it computes the executable nodes in order and returns it
    computeExecutionOrder(only_onExecute: boolean, set_level?: boolean): LGraphNode[] {
        let L: LGraphNode[] = []
        const S: LGraphNode[] = []
        const M: Dictionary<LGraphNode> = {}
        const visited_links: Record<number, boolean> = {} //to avoid repeating links
        const remaining_links: Record<number, number> = {} //to a

        //search for the nodes without inputs (starting nodes)
        for (let i = 0, l = this._nodes.length; i < l; ++i) {
            const node = this._nodes[i]
            if (only_onExecute && !node.onExecute) {
                continue
            }

            M[node.id] = node //add to pending nodes

            let num = 0 //num of input connections
            if (node.inputs) {
                for (let j = 0, l2 = node.inputs.length; j < l2; j++) {
                    if (node.inputs[j]?.link != null) {
                        num += 1
                    }
                }
            }

            if (num == 0) {
                //is a starting node
                S.push(node)
                if (set_level) node._level = 1
            } //num of input links
            else {
                if (set_level) node._level = 0
                remaining_links[node.id] = num
            }
        }

        while (true) {
            if (S.length == 0) break

            //get an starting node
            const node = S.shift()
            L.push(node) //add to ordered list
            delete M[node.id] //remove from the pending nodes

            if (!node.outputs) continue

            //for every output
            for (let i = 0; i < node.outputs.length; i++) {
                const output = node.outputs[i]
                //not connected
                // TODO: Confirm functionality, clean condition
                if (output?.links == null || output.links.length == 0)
                    continue

                //for every connection
                for (let j = 0; j < output.links.length; j++) {
                    const link_id = output.links[j]
                    const link = this.links[link_id]
                    if (!link) continue

                    //already visited link (ignore it)
                    if (visited_links[link.id]) continue

                    const target_node = this.getNodeById(link.target_id)
                    if (target_node == null) {
                        visited_links[link.id] = true
                        continue
                    }

                    if (set_level && (!target_node._level || target_node._level <= node._level)) {
                        target_node._level = node._level + 1
                    }

                    //mark as visited
                    visited_links[link.id] = true
                    //reduce the number of links remaining
                    remaining_links[target_node.id] -= 1

                    //if no more links, then add to starters array
                    if (remaining_links[target_node.id] == 0) S.push(target_node)
                }
            }
        }

        //the remaining ones (loops)
        for (const i in M) {
            L.push(M[i])
        }

        if (L.length != this._nodes.length && LiteGraph.debug)
            console.warn("something went wrong, nodes missing")

        const l = L.length

        //save order number in the node
        for (let i = 0; i < l; ++i) {
            L[i].order = i
        }

        //sort now by priority
        L = L.sort(function (A, B) {
            // @ts-expect-error ctor props
            const Ap = A.constructor.priority || A.priority || 0
            // @ts-expect-error ctor props
            const Bp = B.constructor.priority || B.priority || 0
            //if same priority, sort by order

            return Ap == Bp
                ? A.order - B.order
                : Ap - Bp
        })

        //save order number in the node, again...
        for (let i = 0; i < l; ++i) {
            L[i].order = i
        }

        return L
    }
    /**
     * Returns all the nodes that could affect this one (ancestors) by crawling all the inputs recursively.
     * It doesn't include the node itself
     * @return {Array} an array with all the LGraphNodes that affect this node, in order of execution
     */
    getAncestors(node: LGraphNode): LGraphNode[] {
        const ancestors: LGraphNode[] = []
        const pending = [node]
        const visited: Dictionary<boolean> = {}

        while (pending.length) {
            const current = pending.shift()
            if (!current.inputs) continue

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
        const columns = []
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
                node.pos[0] = (layout == LiteGraph.VERTICAL_LAYOUT) ? y : x
                node.pos[1] = (layout == LiteGraph.VERTICAL_LAYOUT) ? x : y
                const max_size_index = (layout == LiteGraph.VERTICAL_LAYOUT) ? 1 : 0
                if (node.size[max_size_index] > max_size) {
                    max_size = node.size[max_size_index]
                }
                const node_size_index = (layout == LiteGraph.VERTICAL_LAYOUT) ? 0 : 1
                y += node.size[node_size_index] + margin + LiteGraph.NODE_TITLE_HEIGHT
            }
            x += max_size + margin
        }

        this.setDirtyCanvas(true, true)
    }
    /**
     * Returns the amount of time the graph has been running in milliseconds
     * @return {number} number of milliseconds the graph has been running
     */
    getTime(): number {
        return this.globaltime
    }
    /**
     * Returns the amount of time accumulated using the fixedtime_lapse var. This is used in context where the time increments should be constant
     * @return {number} number of milliseconds the graph has been running
     */
    getFixedTime(): number {
        return this.fixedtime
    }
    /**
     * Returns the amount of time it took to compute the latest iteration. Take into account that this number could be not correct
     * if the nodes are using graphical actions
     * @return {number} number of milliseconds it took the last cycle
     */
    getElapsedTime(): number {
        return this.elapsed_time
    }
    /**
     * Sends an event to all the nodes, useful to trigger stuff
     * @param {String} eventname the name of the event (function to be called)
     * @param {Array} params parameters in array format
     */
    sendEventToAllNodes(eventname: string, params?: object | object[], mode?: LGraphEventMode): void {
        mode = mode || LiteGraph.ALWAYS

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
    sendActionToCanvas<T extends MethodNames<LGraphCanvas>>(action: T, params?: ParamsArray<LGraphCanvas, T>): void {
        if (!this.list_of_graphcanvas) return

        for (let i = 0; i < this.list_of_graphcanvas.length; ++i) {
            const c = this.list_of_graphcanvas[i]
            c[action]?.apply(c, params)
        }
    }
    /**
     * Adds a new node instance to this graph
     * @param {LGraphNode} node the instance of the node
     */
    add(node: LGraphNode | LGraphGroup, skip_compute_order?: boolean): LGraphNode | null {
        if (!node) return

        // LEGACY: This was changed from constructor === LGraphGroup
        //groups
        if (node instanceof LGraphGroup) {
            this._groups.push(node)
            this.setDirtyCanvas(true)
            this.change()
            node.graph = this
            this._version++
            return
        }

        //nodes
        if (node.id != -1 && this._nodes_by_id[node.id] != null) {
            console.warn(
                "LiteGraph: there is already a node with this ID, changing it"
            )
            node.id = LiteGraph.use_uuids
                ? LiteGraph.uuidv4()
                : ++this.last_node_id
        }

        if (this._nodes.length >= LiteGraph.MAX_NUMBER_OF_NODES) {
            throw "LiteGraph: max number of nodes in a graph reached"
        }

        //give him an id
        if (LiteGraph.use_uuids) {
            if (node.id == null || node.id == -1)
                node.id = LiteGraph.uuidv4()
        }
        else {
            if (node.id == null || node.id == -1) {
                node.id = ++this.last_node_id
            } else if (typeof node.id === "number" && this.last_node_id < node.id) {
                this.last_node_id = node.id
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

        return node //to chain actions
    }
    /**
     * Removes a node from the graph
     * @param {LGraphNode} node the instance of the node
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

        //not found
        if (this._nodes_by_id[node.id] == null) return
        //cannot be removed
        if (node.ignore_remove) return

        this.beforeChange() //sure? - almost sure is wrong

        //disconnect inputs
        if (node.inputs) {
            for (let i = 0; i < node.inputs.length; i++) {
                const slot = node.inputs[i]
                if (slot.link != null)
                    node.disconnectInput(i)
            }
        }

        //disconnect outputs
        if (node.outputs) {
            for (let i = 0; i < node.outputs.length; i++) {
                const slot = node.outputs[i]
                if (slot.links?.length)
                    node.disconnectOutput(i)
            }
        }

        //callback
        node.onRemoved?.()

        node.graph = null
        this._version++

        //remove from canvas render
        if (this.list_of_graphcanvas) {
            for (let i = 0; i < this.list_of_graphcanvas.length; ++i) {
                const canvas = this.list_of_graphcanvas[i]
                if (canvas.selected_nodes[node.id])
                    delete canvas.selected_nodes[node.id]

                if (canvas.node_dragged == node)
                    canvas.node_dragged = null
            }
        }

        //remove from containers
        const pos = this._nodes.indexOf(node)
        if (pos != -1) this._nodes.splice(pos, 1)

        delete this._nodes_by_id[node.id]

        this.onNodeRemoved?.(node)

        //close panels
        this.sendActionToCanvas("checkPanels")

        this.setDirtyCanvas(true, true)
        this.afterChange() //sure? - almost sure is wrong
        this.change()

        this.updateExecutionOrder()
    }
    /**
     * Returns a node by its id.
     * @param {Number} id
     */
    getNodeById(id: NodeId): LGraphNode | null {
        return id != null
            ? this._nodes_by_id[id]
            : null
    }
    /**
     * Returns a list of nodes that matches a class
     * @param {Class} classObject the class itself (not an string)
     * @return {Array} a list with all the nodes of this type
     */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    findNodesByClass(classObject: Function, result: LGraphNode[]): LGraphNode[] {
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
     * @param {String} type the name of the node type
     * @return {Array} a list with all the nodes of this type
     */
    findNodesByType(type: string, result: LGraphNode[]): LGraphNode[] {
        const matchType = type.toLowerCase()
        result = result || []
        result.length = 0
        for (let i = 0, l = this._nodes.length; i < l; ++i) {
            if (this._nodes[i].type.toLowerCase() == matchType)
                result.push(this._nodes[i])
        }
        return result
    }
    /**
     * Returns the first node that matches a name in its title
     * @param {String} name the name of the node to search
     * @return {Node} the node or null
     */
    findNodeByTitle(title: string): LGraphNode {
        for (let i = 0, l = this._nodes.length; i < l; ++i) {
            if (this._nodes[i].title == title)
                return this._nodes[i]
        }
        return null
    }
    /**
     * Returns a list of nodes that matches a name
     * @param {String} name the name of the node to search
     * @return {Array} a list with all the nodes with this name
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
     * @param {number} x the x coordinate in canvas space
     * @param {number} y the y coordinate in canvas space
     * @param {Array} nodes_list a list with all the nodes to search from, by default is all the nodes in the graph
     * @return {LGraphNode} the node at this position or null
     */
    getNodeOnPos(x: number, y: number, nodes_list?: LGraphNode[], margin?: number): LGraphNode {
        nodes_list = nodes_list || this._nodes
        const nRet = null
        for (let i = nodes_list.length - 1; i >= 0; i--) {
            const n = nodes_list[i]
            // @ts-expect-error ctor props
            const skip_title = n.constructor.title_mode == LiteGraph.NO_TITLE
            if (n.isPointInside(x, y, margin, skip_title)) {
                // check for lesser interest nodes (TODO check for overlapping, use the top)
                /*if (typeof n == "LGraphGroup"){
                    nRet = n;
                }else{*/
                return n
                /*}*/
            }
        }
        return nRet
    }
    /**
     * Returns the top-most group in that position
     * @param x The x coordinate in canvas space
     * @param y The y coordinate in canvas space
     * @return The group or null
     */
    getGroupOnPos(x: number, y: number, { margin = 2 } = {}) {
        return this._groups.reverse().find(g => g.isPointInside(x, y, margin, /* skip_title */ true))
    }

    /**
     * Checks that the node type matches the node type registered, used when replacing a nodetype by a newer version during execution
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
    onAction(action: string, param: unknown, options: { action_call?: string }): void {
        this._input_nodes = this.findNodesByClass(
            // @ts-expect-error Never impl.
            LiteGraph.GraphInput,
            this._input_nodes
        )
        for (let i = 0; i < this._input_nodes.length; ++i) {
            const node = this._input_nodes[i]
            if (node.properties.name != action) continue

            //wrap node.onAction(action, param);
            node.actionDo(action, param, options)
            break
        }
    }
    trigger(action: string, param: unknown) {
        this.onTrigger?.(action, param)
    }
    /**
     * Tell this graph it has a global graph input of this type
     * @param {String} name
     * @param {String} type
     * @param {*} value [optional]
     */
    addInput(name: string, type: string, value?: unknown): void {
        const input = this.inputs[name]
        //already exist
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
     * @param {String} name
     * @param {*} data
     */
    setInputData(name: string, data: unknown): void {
        const input = this.inputs[name]
        if (!input) return
        input.value = data
    }
    /**
     * Returns the current value of a global graph input
     * @param {String} name
     * @return {*} the data
     */
    getInputData(name: string): unknown {
        const input = this.inputs[name]
        return input
            ? input.value
            : null
    }
    /**
     * Changes the name of a global graph input
     * @param {String} old_name
     * @param {String} new_name
     */
    renameInput(old_name: string, name: string): boolean {
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
     * @param {String} name
     * @param {String} type
     */
    changeInputType(name: string, type: string): boolean {
        if (!this.inputs[name]) return false

        if (this.inputs[name].type &&
            String(this.inputs[name].type).toLowerCase() ==
            String(type).toLowerCase()) {
            return
        }

        this.inputs[name].type = type
        this._version++
        this.onInputTypeChanged?.(name, type)
    }
    /**
     * Removes a global graph input
     * @param {String} name
     * @param {String} type
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
     * @param {String} name
     * @param {String} type
     * @param {*} value
     */
    addOutput(name: string, type: string, value: unknown): void {
        this.outputs[name] = { name: name, type: type, value: value }
        this._version++

        this.onOutputAdded?.(name, type)

        this.onInputsOutputsChange?.()
    }
    /**
     * Assign a data to the global output
     * @param {String} name
     * @param {String} value
     */
    setOutputData(name: string, value: unknown): void {
        const output = this.outputs[name]
        if (!output) return
        output.value = value
    }
    /**
     * Returns the current value of a global graph output
     * @param {String} name
     * @return {*} the data
     */
    getOutputData(name: string): unknown {
        const output = this.outputs[name]
        if (!output) return null
        return output.value
    }
    /**
     * Renames a global graph output
     * @param {String} old_name
     * @param {String} new_name
     */
    renameOutput(old_name: string, name: string): boolean {
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
     * @param {String} name
     * @param {String} type
     */
    changeOutputType(name: string, type: string): boolean {
        if (!this.outputs[name]) return false

        if (this.outputs[name].type &&
            String(this.outputs[name].type).toLowerCase() ==
            String(type).toLowerCase()) {
            return
        }

        this.outputs[name].type = type
        this._version++
        this.onOutputTypeChanged?.(name, type)
    }
    /**
     * Removes a global graph output
     * @param {String} name
     */
    removeOutput(name: string): boolean {
        if (!this.outputs[name]) return false

        delete this.outputs[name]
        this._version++

        this.onOutputRemoved?.(name)

        this.onInputsOutputsChange?.()
        return true
    }
    // TODO: Clean up - never implemented.
    triggerInput(name: string, value: any): void {
        const nodes = this.findNodesByTitle(name)
        for (let i = 0; i < nodes.length; ++i) {
            // @ts-expect-error
            nodes[i].onTrigger(value)
        }
    }
    // TODO: Clean up - never implemented.
    setCallback(name: string, func: any): void {
        const nodes = this.findNodesByTitle(name)
        for (let i = 0; i < nodes.length; ++i) {
            // @ts-expect-error
            nodes[i].setTrigger(func)
        }
    }
    //used for undo, called before any change is made to the graph
    beforeChange(info?: LGraphNode): void {
        this.onBeforeChange?.(this, info)
        this.sendActionToCanvas("onBeforeChange", this)
    }
    //used to resend actions, called after any change is made to the graph
    afterChange(info?: LGraphNode): void {
        this.onAfterChange?.(this, info)
        this.sendActionToCanvas("onAfterChange", this)
    }
    connectionChange(node: LGraphNode): void {
        this.updateExecutionOrder()
        this.onConnectionChange?.(node)
        this._version++
        // TODO: Interface never implemented - any consumers?
        // @ts-expect-error
        this.sendActionToCanvas("onConnectionChange")
    }
    /**
     * returns if the graph is in live mode
     */
    isLive(): boolean {
        if (!this.list_of_graphcanvas) return false

        for (let i = 0; i < this.list_of_graphcanvas.length; ++i) {
            const c = this.list_of_graphcanvas[i]
            if (c.live_mode) return true
        }
        return false
    }
    /**
     * clears the triggered slot animation in all links (stop visual animation)
     */
    clearTriggeredSlots(): void {
        for (const i in this.links) {
            const link_info = this.links[i]
            if (!link_info) continue

            if (link_info._last_time)
                link_info._last_time = 0
        }
    }
    /* Called when something visually changed (not the graph!) */
    change(): void {
        if (LiteGraph.debug) {
            console.log("Graph changed")
        }
        this.sendActionToCanvas("setDirty", [true, true])
        this.on_change?.(this)
    }
    setDirtyCanvas(fg: boolean, bg?: boolean): void {
        this.sendActionToCanvas("setDirty", [fg, bg])
    }
    /**
     * Destroys a link
     * @param {Number} link_id
     */
    removeLink(link_id: LinkId): void {
        const link = this.links[link_id]
        if (!link) return

        const node = this.getNodeById(link.target_id)
        node?.disconnectInput(link.target_slot)
    }
    //save and recover app state ***************************************
    /**
     * Creates a Object containing all the info about this graph, it can be serialized
     * @return {Object} value of the node
     */
    serialize(option?: { sortNodes: boolean }): ISerialisedGraph {
        const nodes = !LiteGraph.use_uuids && option?.sortNodes
            // @ts-expect-error If LiteGraph.use_uuids is false, ids are numbers.
            ? [...this._nodes].sort((a, b) => a.id - b.id)
            : this._nodes
        const nodes_info = nodes.map(node => node.serialize())

        //pack link info into a non-verbose format
        const links: SerialisedLLinkArray[] = []
        for (const linkId in this.links) {
            let link = this.links[linkId]
            if (!link.serialize) {
                //weird bug I havent solved yet
                console.warn(
                    "weird LLink bug, link info is not a LLink but a regular object"
                )
                // @ts-expect-error Refactor this shallow copy or add static factory
                const link2 = new LLink()
                for (const j in link) {
                    link2[j] = link[j]
                }
                this.links[linkId] = link2
                link = link2
            }

            links.push(link.serialize())
        }

        const groups_info = []
        for (let i = 0; i < this._groups.length; ++i) {
            groups_info.push(this._groups[i].serialize())
        }

        const data: ISerialisedGraph = {
            last_node_id: this.last_node_id,
            last_link_id: this.last_link_id,
            nodes: nodes_info,
            links: links,
            groups: groups_info,
            config: this.config,
            extra: this.extra,
            version: LiteGraph.VERSION
        }

        this.onSerialize?.(data)
        return data
    }
    /**
     * Configure a graph from a JSON string
     * @param {String} str configure a graph from a JSON string
     * @param {Boolean} returns if there was any error parsing
     */
    configure(data: ISerialisedGraph, keep_old?: boolean): boolean {
        // TODO: Finish typing configure()
        if (!data) return

        if (!keep_old) this.clear()

        const nodesData = data.nodes

        // LEGACY: This was changed from constructor === Array
        //decode links info (they are very verbose)
        if (Array.isArray(data.links)) {
            const links: LLink[] = []
            for (const link_data of data.links) {
                //weird bug
                if (!link_data) {
                    console.warn("serialized graph link data contains errors, skipping.")
                    continue
                }
                // @ts-expect-error Refactor this shallow copy or add static factory
                const link = new LLink()
                link.configure(link_data)
                links[link.id] = link
            }
            data.links = links
        }

        //copy all stored fields
        for (const i in data) {
            //links must be accepted
            if (i == "nodes" || i == "groups")
                continue
            this[i] = data[i]
        }

        let error = false

        //create nodes
        this._nodes = []
        if (nodesData) {
            for (let i = 0, l = nodesData.length; i < l; ++i) {
                const n_info = nodesData[i] //stored info
                let node = LiteGraph.createNode(n_info.type, n_info.title)
                if (!node) {
                    if (LiteGraph.debug) console.log("Node not found or has errors: " + n_info.type)

                    //in case of error we create a replacement node to avoid losing info
                    node = new LGraphNode(undefined)
                    node.last_serialization = n_info
                    node.has_errors = true
                    error = true
                    //continue;
                }

                node.id = n_info.id //id it or it will create a new id
                this.add(node, true) //add before configure, otherwise configure cannot create links
            }

            //configure nodes afterwards so they can reach each other
            for (let i = 0, l = nodesData.length; i < l; ++i) {
                const n_info = nodesData[i]
                const node = this.getNodeById(n_info.id)
                node?.configure(n_info)
            }
        }

        //groups
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
        //from file
        if (url instanceof Blob || url instanceof File) {
            const reader = new FileReader()
            reader.addEventListener('load', function (event) {
                const data = JSON.parse(event.target.result.toString())
                that.configure(data)
                callback?.()
            })

            reader.readAsText(url)
            return
        }

        //is a string, then an URL
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onNodeTrace(node?: LGraphNode, msg?: string) {
        //TODO
    }
}
