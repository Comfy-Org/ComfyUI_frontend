import { LGraph } from "./LGraph"
import { LLink } from "./LLink"
import { LGraphGroup } from "./LGraphGroup"
import { DragAndScale } from "./DragAndScale"
import { LGraphCanvas } from "./LGraphCanvas"
import { ContextMenu } from "./ContextMenu"
import { CurveEditor } from "./CurveEditor"
import {
  LGraphEventMode,
  LinkDirection,
  LinkRenderType,
  NodeSlotType,
  RenderShape,
  TitleMode,
} from "./types/globalEnums"
import { LGraphNode } from "./LGraphNode"
import { SlotShape, SlotDirection, SlotType, LabelPosition } from "./draw"
import type { Dictionary, ISlotType, Rect } from "./interfaces"
import { distance, isInsideRectangle, overlapBounding } from "./measure"

/**
 * The Global Scope. It contains all the registered node classes.
 */
export class LiteGraphGlobal {
  // Enums
  SlotShape = SlotShape
  SlotDirection = SlotDirection
  SlotType = SlotType
  LabelPosition = LabelPosition

  /** Used in serialised graphs at one point. */
  VERSION = 0.4 as const

  CANVAS_GRID_SIZE = 10

  NODE_TITLE_HEIGHT = 30
  NODE_TITLE_TEXT_Y = 20
  NODE_SLOT_HEIGHT = 20
  NODE_WIDGET_HEIGHT = 20
  NODE_WIDTH = 140
  NODE_MIN_WIDTH = 50
  NODE_COLLAPSED_RADIUS = 10
  NODE_COLLAPSED_WIDTH = 80
  NODE_TITLE_COLOR = "#999"
  NODE_SELECTED_TITLE_COLOR = "#FFF"
  NODE_TEXT_SIZE = 14
  NODE_TEXT_COLOR = "#AAA"
  NODE_TEXT_HIGHLIGHT_COLOR = "#EEE"
  NODE_SUBTEXT_SIZE = 12
  NODE_DEFAULT_COLOR = "#333"
  NODE_DEFAULT_BGCOLOR = "#353535"
  NODE_DEFAULT_BOXCOLOR = "#666"
  NODE_DEFAULT_SHAPE = "box"
  NODE_BOX_OUTLINE_COLOR = "#FFF"
  NODE_ERROR_COLOUR = "#E00"
  DEFAULT_SHADOW_COLOR = "rgba(0,0,0,0.5)"
  DEFAULT_GROUP_FONT = 24
  DEFAULT_GROUP_FONT_SIZE?: any

  WIDGET_BGCOLOR = "#222"
  WIDGET_OUTLINE_COLOR = "#666"
  WIDGET_ADVANCED_OUTLINE_COLOR = "rgba(56, 139, 253, 0.8)"
  WIDGET_TEXT_COLOR = "#DDD"
  WIDGET_SECONDARY_TEXT_COLOR = "#999"

  LINK_COLOR = "#9A9"
  // TODO: This is a workaround until LGraphCanvas.link_type_colors is no longer static.
  static DEFAULT_EVENT_LINK_COLOR = "#A86"
  EVENT_LINK_COLOR = "#A86"
  CONNECTING_LINK_COLOR = "#AFA"

  /** avoid infinite loops */
  MAX_NUMBER_OF_NODES = 10000
  /** default node position */
  DEFAULT_POSITION = [100, 100]
  /** ,"circle" */
  VALID_SHAPES = ["default", "box", "round", "card"]

  // shapes are used for nodes but also for slots
  BOX_SHAPE = RenderShape.BOX
  ROUND_SHAPE = RenderShape.ROUND
  CIRCLE_SHAPE = RenderShape.CIRCLE
  CARD_SHAPE = RenderShape.CARD
  ARROW_SHAPE = RenderShape.ARROW
  /** intended for slot arrays */
  GRID_SHAPE = RenderShape.GRID

  // enums
  INPUT = NodeSlotType.INPUT
  OUTPUT = NodeSlotType.OUTPUT

  // TODO: -1 can lead to ambiguity in JS; these should be updated to a more explicit constant or Symbol.
  /** for outputs */
  EVENT = -1 as const
  /** for inputs */
  ACTION = -1 as const

  /** helper, will add "On Request" and more in the future */
  NODE_MODES = ["Always", "On Event", "Never", "On Trigger"]
  /** use with node_box_coloured_by_mode */
  NODE_MODES_COLORS = ["#666", "#422", "#333", "#224", "#626"]
  ALWAYS = LGraphEventMode.ALWAYS
  ON_EVENT = LGraphEventMode.ON_EVENT
  NEVER = LGraphEventMode.NEVER
  ON_TRIGGER = LGraphEventMode.ON_TRIGGER

  UP = LinkDirection.UP
  DOWN = LinkDirection.DOWN
  LEFT = LinkDirection.LEFT
  RIGHT = LinkDirection.RIGHT
  CENTER = LinkDirection.CENTER

  /** helper */
  LINK_RENDER_MODES = ["Straight", "Linear", "Spline"]
  HIDDEN_LINK = LinkRenderType.HIDDEN_LINK
  STRAIGHT_LINK = LinkRenderType.STRAIGHT_LINK
  LINEAR_LINK = LinkRenderType.LINEAR_LINK
  SPLINE_LINK = LinkRenderType.SPLINE_LINK

  NORMAL_TITLE = TitleMode.NORMAL_TITLE
  NO_TITLE = TitleMode.NO_TITLE
  TRANSPARENT_TITLE = TitleMode.TRANSPARENT_TITLE
  AUTOHIDE_TITLE = TitleMode.AUTOHIDE_TITLE

  /** arrange nodes vertically */
  VERTICAL_LAYOUT = "vertical"

  /** used to redirect calls */
  proxy = null
  node_images_path = ""

  debug = false
  catch_exceptions = true
  throw_errors = true
  allow_scripts = false // if set to true some nodes like Formula would be allowed to evaluate code that comes from unsafe sources (like node configuration), which could lead to exploits
  /** nodetypes by string */
  registered_node_types: Record<string, typeof LGraphNode> = {}
  /** used for dropping files in the canvas */
  node_types_by_file_extension = {}
  /** node types by classname */
  Nodes: Record<string, typeof LGraphNode> = {}
  /** used to store vars between graphs */
  Globals = {}

  /** used to add extra features to the search box */
  searchbox_extras = {}
  /** [true!] If set to true, will automatically sort node types / categories in the context menus */
  auto_sort_node_types = false

  /** [true!] this make the nodes box (top left circle) coloured when triggered (execute/action), visual feedback */
  node_box_coloured_when_on = false
  /** [true!] nodebox based on node mode, visual feedback */
  node_box_coloured_by_mode = false

  /** [false on mobile] better true if not touch device, TODO add an helper/listener to close if false */
  dialog_close_on_mouse_leave = false
  dialog_close_on_mouse_leave_delay = 500

  /** [false!] prefer false if results too easy to break links - implement with ALT or TODO custom keys */
  shift_click_do_break_link_from = false
  /** [false!]prefer false, way too easy to break links */
  click_do_break_link_to = false
  /** [true!] who accidentally ctrl-alt-clicks on an in/output? nobody! that's who! */
  ctrl_alt_click_do_break_link = true
  /** [true!] snaps links when dragging connections over valid targets */
  snaps_for_comfy = true
  /** [true!] renders a partial border to highlight when a dragged link is snapped to a node */
  snap_highlights_node = true

  /**
   * If `true`, items always snap to the grid - modifier keys are ignored.
   * When {@link snapToGrid} is falsy, a value of `1` is used.
   * Default: `false`
   */
  alwaysSnapToGrid?: boolean

  /**
   * When set to a positive number, when nodes are moved their positions will
   * be rounded to the nearest multiple of this value.  Half up.
   * Default: `undefined`
   * @todo Not implemented - see {@link LiteGraph.CANVAS_GRID_SIZE}
   */
  snapToGrid?: number

  /** [false on mobile] better true if not touch device, TODO add an helper/listener to close if false */
  search_hide_on_mouse_leave = true
  /**
   * [true!] enable filtering slots type in the search widget
   * !requires auto_load_slot_types or manual set registered_slot_[in/out]_types and slot_types_[in/out]
   */
  search_filter_enabled = false
  /** [true!] opens the results list when opening the search widget */
  search_show_all_on_open = true

  /**
   * [if want false, use true, run, get vars values to be statically set, than disable]
   * nodes types and nodeclass association with node types need to be calculated,
   * if dont want this, calculate once and set registered_slot_[in/out]_types and slot_types_[in/out]
   */
  auto_load_slot_types = false

  // set these values if not using auto_load_slot_types
  /** slot types for nodeclass */
  registered_slot_in_types: Record<string, { nodes: string[] }> = {}
  /** slot types for nodeclass */
  registered_slot_out_types: Record<string, { nodes: string[] }> = {}
  /** slot types IN */
  slot_types_in: string[] = []
  /** slot types OUT */
  slot_types_out: string[] = []
  /**
   * specify for each IN slot type a(/many) default node(s), use single string, array, or object
   * (with node, title, parameters, ..) like for search
   */
  slot_types_default_in: Record<string, string[]> = {}
  /**
   * specify for each OUT slot type a(/many) default node(s), use single string, array, or object
   * (with node, title, parameters, ..) like for search
   */
  slot_types_default_out: Record<string, string[]> = {}

  /** [true!] very handy, ALT click to clone and drag the new node */
  alt_drag_do_clone_nodes = false

  /**
   * [true!] will create and connect event slots when using action/events connections,
   * !WILL CHANGE node mode when using onTrigger (enable mode colors), onExecuted does not need this
   */
  do_add_triggers_slots = false

  /** [false!] being events, it is strongly reccomended to use them sequentially, one by one */
  allow_multi_output_for_events = true

  /** [true!] allows to create and connect a ndoe clicking with the third button (wheel) */
  middle_click_slot_add_default_node = false

  /** [true!] dragging a link to empty space will open a menu, add from list, search or defaults */
  release_link_on_empty_shows_menu = false

  /** "mouse"|"pointer" use mouse for retrocompatibility issues? (none found @ now) */
  pointerevents_method = "pointer"

  /**
   * [true!] allows ctrl + shift + v to paste nodes with the outputs of the unselected nodes connected
   * with the inputs of the newly pasted nodes
   */
  ctrl_shift_v_paste_connect_unselected_outputs = true

  // if true, all newly created nodes/links will use string UUIDs for their id fields instead of integers.
  // use this if you must have node IDs that are unique across all graphs and subgraphs.
  use_uuids = false

  // Whether to highlight the bounding box of selected groups
  highlight_selected_group = true

  /** If `true`, the old "eye-melting-red" error indicator will be used for nodes */
  use_legacy_node_error_indicator = false

  // TODO: Remove legacy accessors
  LGraph = LGraph
  LLink = LLink
  LGraphNode = LGraphNode
  LGraphGroup = LGraphGroup
  DragAndScale = DragAndScale
  LGraphCanvas = LGraphCanvas
  ContextMenu = ContextMenu
  CurveEditor = CurveEditor

  onNodeTypeRegistered?(type: string, base_class: typeof LGraphNode): void
  onNodeTypeReplaced?(type: string, base_class: typeof LGraphNode, prev: unknown): void

  // Avoid circular dependency from original single-module
  static {
    LGraphCanvas.link_type_colors = {
      "-1": LiteGraphGlobal.DEFAULT_EVENT_LINK_COLOR,
      "number": "#AAA",
      "node": "#DCA",
    }
  }

  constructor() {
    // timer that works everywhere
    if (typeof performance != "undefined") {
      this.getTime = performance.now.bind(performance)
    } else if (typeof Date != "undefined" && Date.now) {
      this.getTime = Date.now.bind(Date)
    } else if (typeof process != "undefined") {
      this.getTime = function () {
        const t = process.hrtime()
        return t[0] * 0.001 + t[1] * 1e-6
      }
    } else {
      this.getTime = function () {
        return new Date().getTime()
      }
    }
  }

  /**
   * Register a node class so it can be listed when the user wants to create a new one
   * @param type name of the node and path
   * @param base_class class containing the structure of a node
   */
  registerNodeType(type: string, base_class: typeof LGraphNode): void {
    if (!base_class.prototype)
      throw "Cannot register a simple object, it must be a class with a prototype"
    base_class.type = type

    if (this.debug) console.log("Node registered: " + type)

    const classname = base_class.name

    const pos = type.lastIndexOf("/")
    base_class.category = type.substring(0, pos)

    base_class.title ||= classname

    // extend class
    for (const i in LGraphNode.prototype) {
      base_class.prototype[i] ||= LGraphNode.prototype[i]
    }

    const prev = this.registered_node_types[type]
    if (prev) {
      console.log("replacing node type: " + type)
    }
    if (!Object.prototype.hasOwnProperty.call(base_class.prototype, "shape")) {
      Object.defineProperty(base_class.prototype, "shape", {
        set(this: LGraphNode, v: RenderShape | "default" | "box" | "round" | "circle" | "card") {
          switch (v) {
          case "default":
            delete this._shape
            break
          case "box":
            this._shape = RenderShape.BOX
            break
          case "round":
            this._shape = RenderShape.ROUND
            break
          case "circle":
            this._shape = RenderShape.CIRCLE
            break
          case "card":
            this._shape = RenderShape.CARD
            break
          default:
            this._shape = v
          }
        },
        get() {
          return this._shape
        },
        enumerable: true,
        configurable: true,
      })

      // used to know which nodes to create when dragging files to the canvas
      if (base_class.supported_extensions) {
        for (const i in base_class.supported_extensions) {
          const ext = base_class.supported_extensions[i]
          if (ext && typeof ext === "string") {
            this.node_types_by_file_extension[ext.toLowerCase()] = base_class
          }
        }
      }
    }

    this.registered_node_types[type] = base_class
    if (base_class.constructor.name) this.Nodes[classname] = base_class

    this.onNodeTypeRegistered?.(type, base_class)
    if (prev) this.onNodeTypeReplaced?.(type, base_class, prev)

    // warnings
    if (base_class.prototype.onPropertyChange)
      console.warn(`LiteGraph node class ${type} has onPropertyChange method, it must be called onPropertyChanged with d at the end`)

    // TODO one would want to know input and ouput :: this would allow through registerNodeAndSlotType to get all the slots types
    if (this.auto_load_slot_types) new base_class(base_class.title || "tmpnode")
  }

  /**
   * removes a node type from the system
   * @param type name of the node or the node constructor itself
   */
  unregisterNodeType(type: string | typeof LGraphNode): void {
    const base_class = typeof type === "string"
      ? this.registered_node_types[type]
      : type
    if (!base_class) throw "node type not found: " + type

    delete this.registered_node_types[base_class.type]

    const name = base_class.constructor.name
    if (name) delete this.Nodes[name]
  }

  /**
   * Save a slot type and his node
   * @param type name of the node or the node constructor itself
   * @param slot_type name of the slot type (variable type), eg. string, number, array, boolean, ..
   */
  registerNodeAndSlotType(
    type: LGraphNode,
    slot_type: ISlotType,
    out?: boolean,
  ): void {
    out ||= false
    // @ts-expect-error Confirm this function no longer supports string types - base_class should always be an instance not a constructor.
    const base_class = typeof type === "string" && this.registered_node_types[type] !== "anonymous"
      ? this.registered_node_types[type]
      : type

    // @ts-expect-error Confirm this function no longer supports string types - base_class should always be an instance not a constructor.
    const class_type = base_class.constructor.type

    let allTypes = []
    if (typeof slot_type === "string") {
      allTypes = slot_type.split(",")
    } else if (slot_type == this.EVENT || slot_type == this.ACTION) {
      allTypes = ["_event_"]
    } else {
      allTypes = ["*"]
    }

    for (let i = 0; i < allTypes.length; ++i) {
      let slotType = allTypes[i]
      if (slotType === "") slotType = "*"

      const registerTo = out
        ? "registered_slot_out_types"
        : "registered_slot_in_types"
      if (this[registerTo][slotType] === undefined)
        this[registerTo][slotType] = { nodes: [] }
      if (!this[registerTo][slotType].nodes.includes(class_type))
        this[registerTo][slotType].nodes.push(class_type)

      // check if is a new type
      const types = out
        ? this.slot_types_out
        : this.slot_types_in
      if (!types.includes(slotType.toLowerCase())) {
        types.push(slotType.toLowerCase())
        types.sort()
      }
    }
  }

  /**
   * Create a new nodetype by passing a function, it wraps it with a proper class and
   * generates inputs according to the parameters of the function.
   * Useful to wrap simple methods that do not require properties, and that only process some input to generate an output.
   * @param name node name with namespace (p.e.: 'math/sum')
   * @param func
   * @param param_types [optional] an array containing the type of every parameter,
   * otherwise parameters will accept any type
   * @param return_type [optional] string with the return type, otherwise it will be generic
   * @param properties [optional] properties to be configurable
   */
  wrapFunctionAsNode(
    name: string,
    func: (...args: any) => any,
    param_types: string[],
    return_type: string,
    properties: unknown,
  ) {
    const params = Array(func.length)
    let code = ""
    const names = this.getParameterNames(func)
    for (let i = 0; i < names.length; ++i) {
      code += `this.addInput('${names[i]}',${param_types && param_types[i] ? `'${param_types[i]}'` : "0"});\n`
    }
    code += `this.addOutput('out',${return_type ? `'${return_type}'` : 0});\n`
    if (properties) code += `this.properties = ${JSON.stringify(properties)};\n`

    const classobj = Function(code)
    // @ts-ignore
    classobj.title = name.split("/").pop()
    // @ts-ignore
    classobj.desc = "Generated from " + func.name
    classobj.prototype.onExecute = function onExecute() {
      for (let i = 0; i < params.length; ++i) {
        params[i] = this.getInputData(i)
      }
      const r = func.apply(this, params)
      this.setOutputData(0, r)
    }
    // @ts-expect-error Required to make this kludge work
    this.registerNodeType(name, classobj)
  }

  /**
   * Removes all previously registered node's types
   */
  clearRegisteredTypes(): void {
    this.registered_node_types = {}
    this.node_types_by_file_extension = {}
    this.Nodes = {}
    this.searchbox_extras = {}
  }

  /**
   * Adds this method to all nodetypes, existing and to be created
   * (You can add it to LGraphNode.prototype but then existing node types wont have it)
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  addNodeMethod(name: string, func: Function): void {
    LGraphNode.prototype[name] = func
    for (const i in this.registered_node_types) {
      const type = this.registered_node_types[i]
      // keep old in case of replacing
      if (type.prototype[name]) type.prototype["_" + name] = type.prototype[name]
      type.prototype[name] = func
    }
  }

  /**
   * Create a node of a given type with a name. The node is not attached to any graph yet.
   * @param type full name of the node class. p.e. "math/sin"
   * @param title a name to distinguish from other nodes
   * @param options to set options
   */
  createNode(
    type: string,
    title?: string,
    options?: Dictionary<unknown>,
  ): LGraphNode {
    const base_class = this.registered_node_types[type]
    if (!base_class) {
      if (this.debug) console.log(`GraphNode type "${type}" not registered.`)
      return null
    }

    title = title || base_class.title || type

    let node = null

    if (this.catch_exceptions) {
      try {
        node = new base_class(title)
      } catch (err) {
        console.error(err)
        return null
      }
    } else {
      node = new base_class(title)
    }

    node.type = type

    if (!node.title && title) node.title = title
    node.properties ||= {}
    node.properties_info ||= []
    node.flags ||= {}
    // call onresize?
    node.size ||= node.computeSize()
    node.pos ||= this.DEFAULT_POSITION.concat()
    node.mode ||= LGraphEventMode.ALWAYS

    // extra options
    if (options) {
      for (const i in options) {
        node[i] = options[i]
      }
    }

    // callback
    node.onNodeCreated?.()
    return node
  }

  /**
   * Returns a registered node type with a given name
   * @param type full name of the node class. p.e. "math/sin"
   * @returns the node class
   */
  getNodeType(type: string): typeof LGraphNode {
    return this.registered_node_types[type]
  }

  /**
   * Returns a list of node types matching one category
   * @param category category name
   * @returns array with all the node classes
   */
  getNodeTypesInCategory(category: string, filter: any) {
    const r = []
    for (const i in this.registered_node_types) {
      const type = this.registered_node_types[i]
      if (type.filter != filter) continue

      if (category == "") {
        if (type.category == null) r.push(type)
      } else if (type.category == category) {
        r.push(type)
      }
    }

    if (this.auto_sort_node_types) {
      r.sort(function (a, b) {
        return a.title.localeCompare(b.title)
      })
    }

    return r
  }

  /**
   * Returns a list with all the node type categories
   * @param filter only nodes with ctor.filter equal can be shown
   * @returns array with all the names of the categories
   */
  getNodeTypesCategories(filter: string): string[] {
    const categories = { "": 1 }
    for (const i in this.registered_node_types) {
      const type = this.registered_node_types[i]
      if (type.category && !type.skip_list) {
        if (type.filter != filter) continue

        categories[type.category] = 1
      }
    }
    const result = []
    for (const i in categories) {
      result.push(i)
    }
    return this.auto_sort_node_types ? result.sort() : result
  }

  // debug purposes: reloads all the js scripts that matches a wildcard
  reloadNodes(folder_wildcard: string): void {
    const tmp = document.getElementsByTagName("script")
    // weird, this array changes by its own, so we use a copy
    const script_files = []
    for (let i = 0; i < tmp.length; i++) {
      script_files.push(tmp[i])
    }

    const docHeadObj = document.getElementsByTagName("head")[0]
    folder_wildcard = document.location.href + folder_wildcard

    for (let i = 0; i < script_files.length; i++) {
      const src = script_files[i].src
      if (!src || src.substr(0, folder_wildcard.length) != folder_wildcard)
        continue

      try {
        if (this.debug) console.log("Reloading: " + src)
        const dynamicScript = document.createElement("script")
        dynamicScript.type = "text/javascript"
        dynamicScript.src = src
        docHeadObj.appendChild(dynamicScript)
        docHeadObj.removeChild(script_files[i])
      } catch (err) {
        if (this.throw_errors) throw err
        if (this.debug) console.log("Error while reloading " + src)
      }
    }

    if (this.debug) console.log("Nodes reloaded")
  }

  // separated just to improve if it doesn't work
  cloneObject<T extends object>(obj: T, target?: T): T {
    if (obj == null) return null

    const r = JSON.parse(JSON.stringify(obj))
    if (!target) return r

    for (const i in r) {
      target[i] = r[i]
    }
    return target
  }

  /*
   * https://gist.github.com/jed/982883?permalink_comment_id=852670#gistcomment-852670
   */
  uuidv4(): string {
    // @ts-ignore
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, a =>
      (a ^ ((Math.random() * 16) >> (a / 4))).toString(16))
  }

  /**
   * Returns if the types of two slots are compatible (taking into account wildcards, etc)
   * @param type_a output
   * @param type_b input
   * @returns true if they can be connected
   */
  isValidConnection(type_a: ISlotType, type_b: ISlotType): boolean {
    if (type_a == "" || type_a === "*") type_a = 0
    if (type_b == "" || type_b === "*") type_b = 0
    // If generic in/output, matching types (valid for triggers), or event/action types
    if (
      !type_a ||
      !type_b ||
      type_a == type_b ||
      (type_a == this.EVENT && type_b == this.ACTION)
    )
      return true

    // Enforce string type to handle toLowerCase call (-1 number not ok)
    type_a = String(type_a)
    type_b = String(type_b)
    type_a = type_a.toLowerCase()
    type_b = type_b.toLowerCase()

    // For nodes supporting multiple connection types
    if (type_a.indexOf(",") == -1 && type_b.indexOf(",") == -1)
      return type_a == type_b

    // Check all permutations to see if one is valid
    const supported_types_a = type_a.split(",")
    const supported_types_b = type_b.split(",")
    for (let i = 0; i < supported_types_a.length; ++i) {
      for (let j = 0; j < supported_types_b.length; ++j) {
        if (this.isValidConnection(supported_types_a[i], supported_types_b[j]))
          return true
      }
    }

    return false
  }

  /**
   * Register a string in the search box so when the user types it it will recommend this node
   * @param node_type the node recommended
   * @param description text to show next to it
   * @param data it could contain info of how the node should be configured
   */
  registerSearchboxExtra(node_type: any, description: string, data: any): void {
    this.searchbox_extras[description.toLowerCase()] = {
      type: node_type,
      desc: description,
      data: data,
    }
  }

  /**
   * Wrapper to load files (from url using fetch or from file using FileReader)
   * @param url the url of the file (or the file itself)
   * @param type an string to know how to fetch it: "text","arraybuffer","json","blob"
   * @param on_complete callback(data)
   * @param on_error in case of an error
   * @returns returns the object used to
   */
  fetchFile(
    url: string | URL | Request | Blob,
    type: string,
    on_complete: (data: string | ArrayBuffer) => void,
    on_error: (error: unknown) => void,
  ): void | Promise<void> {
    if (!url) return null

    type = type || "text"
    if (typeof url === "string") {
      if (url.substr(0, 4) == "http" && this.proxy)
        url = this.proxy + url.substr(url.indexOf(":") + 3)

      return fetch(url)
        .then(function (response) {
          if (!response.ok)
            throw new Error("File not found") // it will be catch below
          if (type == "arraybuffer")
            return response.arrayBuffer()
          else if (type == "text" || type == "string")
            return response.text()
          else if (type == "json")
            return response.json()
          else if (type == "blob")
            return response.blob()
        })
        .then(function (data: string | ArrayBuffer): void {
          on_complete?.(data)
        })
        .catch(function (error) {
          console.error("error fetching file:", url)
          on_error?.(error)
        })
    } else if (url instanceof File || url instanceof Blob) {
      const reader = new FileReader()
      reader.onload = function (e) {
        let v = e.target.result
        if (type == "json")
          // @ts-ignore
          v = JSON.parse(v)
        on_complete?.(v)
      }
      if (type == "arraybuffer")
        return reader.readAsArrayBuffer(url)
      else if (type == "text" || type == "json")
        return reader.readAsText(url)
      else if (type == "blob")
        return reader.readAsBinaryString(url)
    }
    return null
  }

  // used to create nodes from wrapping functions
  getParameterNames(func: (...args: any) => any): string[] {
    return (func + "")
      .replace(/[/][/].*$/gm, "") // strip single-line comments
      .replace(/\s+/g, "") // strip white space
      .replace(/[/][*][^/*]*[*][/]/g, "") // strip multi-line comments  /**/
      .split("){", 1)[0]
      .replace(/^[^(]*[(]/, "") // extract the parameters
      .replace(/=[^,]+/g, "") // strip any ES6 defaults
      .split(",")
      .filter(Boolean) // split & filter [""]
  }

  /* helper for interaction: pointer, touch, mouse Listeners
    used by LGraphCanvas DragAndScale ContextMenu */
  pointerListenerAdd(oDOM: Node, sEvIn: string, fCall: (e: Event) => boolean | void, capture = false): void {
    if (!oDOM || !oDOM.addEventListener || !sEvIn || typeof fCall !== "function") return

    let sMethod = this.pointerevents_method
    let sEvent = sEvIn

    // UNDER CONSTRUCTION
    // convert pointerevents to touch event when not available
    if (sMethod == "pointer" && !window.PointerEvent) {
      console.warn("sMethod=='pointer' && !window.PointerEvent")
      console.log("Converting pointer[" + sEvent + "] : down move up cancel enter TO touchstart touchmove touchend, etc ..")
      switch (sEvent) {
      case "down": {
        sMethod = "touch"
        sEvent = "start"
        break
      }
      case "move": {
        sMethod = "touch"
        // sEvent = "move";
        break
      }
      case "up": {
        sMethod = "touch"
        sEvent = "end"
        break
      }
      case "cancel": {
        sMethod = "touch"
        // sEvent = "cancel";
        break
      }
      case "enter": {
        console.log("debug: Should I send a move event?") // ???
        break
      }
      // case "over": case "out": not used at now
      default: {
        console.warn("PointerEvent not available in this browser ? The event " + sEvent + " would not be called")
      }
      }
    }

    switch (sEvent) {
    // @ts-expect-error
    // both pointer and move events
    case "down": case "up": case "move": case "over": case "out": case "enter":
    {
      oDOM.addEventListener(sMethod + sEvent, fCall, capture)
    }
    // @ts-expect-error
    // only pointerevents
    case "leave": case "cancel": case "gotpointercapture": case "lostpointercapture":
    {
      if (sMethod != "mouse") {
        return oDOM.addEventListener(sMethod + sEvent, fCall, capture)
      }
    }
    // not "pointer" || "mouse"
    default:
      return oDOM.addEventListener(sEvent, fCall, capture)
    }
  }

  pointerListenerRemove(oDOM: Node, sEvent: string, fCall: (e: Event) => boolean | void, capture = false): void {
    if (!oDOM || !oDOM.removeEventListener || !sEvent || typeof fCall !== "function") return

    switch (sEvent) {
    // @ts-expect-error
    // both pointer and move events
    case "down": case "up": case "move": case "over": case "out": case "enter":
    {
      if (this.pointerevents_method == "pointer" || this.pointerevents_method == "mouse") {
        oDOM.removeEventListener(this.pointerevents_method + sEvent, fCall, capture)
      }
    }
    // @ts-expect-error
    // only pointerevents
    case "leave": case "cancel": case "gotpointercapture": case "lostpointercapture":
    {
      if (this.pointerevents_method == "pointer") {
        return oDOM.removeEventListener(this.pointerevents_method + sEvent, fCall, capture)
      }
    }
    // not "pointer" || "mouse"
    default:
      return oDOM.removeEventListener(sEvent, fCall, capture)
    }
  }

  getTime: () => number

  compareObjects(a: object, b: object): boolean {
    for (const i in a) {
      if (a[i] != b[i]) return false
    }
    return true
  }

  distance = distance

  colorToString(c: [number, number, number, number]): string {
    return (
      "rgba(" +
      Math.round(c[0] * 255).toFixed() +
      "," +
      Math.round(c[1] * 255).toFixed() +
      "," +
      Math.round(c[2] * 255).toFixed() +
      "," +
      (c.length == 4 ? c[3].toFixed(2) : "1.0") +
      ")"
    )
  }

  isInsideRectangle = isInsideRectangle

  // [minx,miny,maxx,maxy]
  growBounding(bounding: Rect, x: number, y: number): void {
    if (x < bounding[0]) {
      bounding[0] = x
    } else if (x > bounding[2]) {
      bounding[2] = x
    }

    if (y < bounding[1]) {
      bounding[1] = y
    } else if (y > bounding[3]) {
      bounding[3] = y
    }
  }

  overlapBounding = overlapBounding

  // point inside bounding box
  isInsideBounding(p: number[], bb: number[][]): boolean {
    if (
      p[0] < bb[0][0] ||
      p[1] < bb[0][1] ||
      p[0] > bb[1][0] ||
      p[1] > bb[1][1]
    ) {
      return false
    }
    return true
  }

  // Convert a hex value to its decimal value - the inputted hex must be in the
  // format of a hex triplet - the kind we use for HTML colours. The function
  // will return an array with three values.
  hex2num(hex: string): number[] {
    if (hex.charAt(0) == "#") {
      hex = hex.slice(1)
    } // Remove the '#' char - if there is one.
    hex = hex.toUpperCase()
    const hex_alphabets = "0123456789ABCDEF"
    const value = new Array(3)
    let k = 0
    let int1, int2
    for (let i = 0; i < 6; i += 2) {
      int1 = hex_alphabets.indexOf(hex.charAt(i))
      int2 = hex_alphabets.indexOf(hex.charAt(i + 1))
      value[k] = int1 * 16 + int2
      k++
    }
    return value
  }

  // Give a array with three values as the argument and the function will return
  // the corresponding hex triplet.
  num2hex(triplet: number[]): string {
    const hex_alphabets = "0123456789ABCDEF"
    let hex = "#"
    let int1, int2
    for (let i = 0; i < 3; i++) {
      int1 = triplet[i] / 16
      int2 = triplet[i] % 16

      hex += hex_alphabets.charAt(int1) + hex_alphabets.charAt(int2)
    }
    return hex
  }

  closeAllContextMenus(ref_window: Window): void {
    ref_window = ref_window || window

    const elements = ref_window.document.querySelectorAll(".litecontextmenu")
    if (!elements.length) return

    const result = []
    for (let i = 0; i < elements.length; i++) {
      result.push(elements[i])
    }

    for (let i = 0; i < result.length; i++) {
      if (result[i].close) {
        result[i].close()
      } else if (result[i].parentNode) {
        result[i].parentNode.removeChild(result[i])
      }
    }
  }

  extendClass(target: any, origin: any): void {
    for (const i in origin) {
      // copy class properties
      if (target.hasOwnProperty(i)) continue
      target[i] = origin[i]
    }

    if (origin.prototype) {
      // copy prototype properties
      for (const i in origin.prototype) {
        // only enumerable
        if (!origin.prototype.hasOwnProperty(i)) continue

        // avoid overwriting existing ones
        if (target.prototype.hasOwnProperty(i)) continue

        // copy getters
        if (origin.prototype.__lookupGetter__(i)) {
          target.prototype.__defineGetter__(
            i,
            origin.prototype.__lookupGetter__(i),
          )
        } else {
          target.prototype[i] = origin.prototype[i]
        }

        // and setters
        if (origin.prototype.__lookupSetter__(i)) {
          target.prototype.__defineSetter__(
            i,
            origin.prototype.__lookupSetter__(i),
          )
        }
      }
    }
  }
}
