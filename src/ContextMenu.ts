import type { IContextMenuOptions, IContextMenuValue } from "./interfaces"
import { LiteGraph } from "./litegraph"

interface ContextMenuDivElement extends HTMLDivElement {
  value?: IContextMenuValue | string
  onclick_callback?: never
  closing_timer?: number
}

// TODO: Replace this pattern with something more modern.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface ContextMenu {
  constructor: new (...args: ConstructorParameters<typeof ContextMenu>) => ContextMenu
}

/**
 * ContextMenu from LiteGUI
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class ContextMenu {
  options?: IContextMenuOptions
  parentMenu?: ContextMenu
  root: ContextMenuDivElement
  current_submenu?: ContextMenu
  lock?: boolean

  /**
   * @todo Interface for values requires functionality change - currently accepts
   * an array of strings, functions, objects, nulls, or undefined.
   * @param values (allows object { title: "Nice text", callback: function ... })
   * @param options [optional] Some options:\
   * - title: title to show on top of the menu
   * - callback: function to call when an option is clicked, it receives the item information
   * - ignore_item_callbacks: ignores the callback inside the item, it just calls the options.callback
   * - event: you can pass a MouseEvent, this way the ContextMenu appears in that position
   */
  constructor(values: (IContextMenuValue | string)[], options: IContextMenuOptions) {
    options ||= {}
    this.options = options

    // to link a menu with its parent
    const parent = options.parentMenu
    if (parent) {
      if (!(parent instanceof ContextMenu)) {
        console.error("parentMenu must be of class ContextMenu, ignoring it")
        options.parentMenu = null
      } else {
        this.parentMenu = parent
        this.parentMenu.lock = true
        this.parentMenu.current_submenu = this
      }
      if (parent.options?.className === "dark") {
        options.className = "dark"
      }
    }

    // use strings because comparing classes between windows doesnt work
    const eventClass = options.event
      ? options.event.constructor.name
      : null
    if (
      eventClass !== "MouseEvent" &&
      eventClass !== "CustomEvent" &&
      eventClass !== "PointerEvent"
    ) {
      console.error(`Event passed to ContextMenu is not of type MouseEvent or CustomEvent. Ignoring it. (${eventClass})`)
      options.event = null
    }

    const root: ContextMenuDivElement = document.createElement("div")
    let classes = "litegraph litecontextmenu litemenubar-panel"
    if (options.className) classes += " " + options.className
    root.className = classes
    root.style.minWidth = "100"
    root.style.minHeight = "100"
    // TODO: Fix use of timer in place of events
    root.style.pointerEvents = "none"
    setTimeout(function () {
      root.style.pointerEvents = "auto"
    }, 100) // delay so the mouse up event is not caught by this element

    // this prevents the default context browser menu to open in case this menu was created when pressing right button
    LiteGraph.pointerListenerAdd(
      root,
      "up",
      function (e: MouseEvent) {
        // console.log("pointerevents: ContextMenu up root prevent");
        e.preventDefault()
        return true
      },
      true,
    )
    root.addEventListener(
      "contextmenu",
      function (e: MouseEvent) {
        // right button
        if (e.button != 2) return false
        e.preventDefault()
        return false
      },
      true,
    )

    LiteGraph.pointerListenerAdd(
      root,
      "down",
      (e: MouseEvent) => {
        // console.log("pointerevents: ContextMenu down");
        if (e.button == 2) {
          this.close()
          e.preventDefault()
          return true
        }
      },
      true,
    )

    function on_mouse_wheel(e: WheelEvent) {
      const pos = parseInt(root.style.top)
      root.style.top = (pos + e.deltaY * options.scroll_speed).toFixed() + "px"
      e.preventDefault()
      return true
    }

    if (!options.scroll_speed) {
      options.scroll_speed = 0.1
    }

    root.addEventListener("wheel", on_mouse_wheel, true)

    this.root = root

    // title
    if (options.title) {
      const element = document.createElement("div")
      element.className = "litemenu-title"
      element.innerHTML = options.title
      root.appendChild(element)
    }

    // entries
    for (let i = 0; i < values.length; i++) {
      const value = values[i]
      let name = Array.isArray(values) ? value : String(i)

      if (typeof name !== "string") {
        name = name != null
          ? name.content === undefined ? String(name) : name.content
          : name as null | undefined
      }

      this.addItem(name, value, options)
    }

    LiteGraph.pointerListenerAdd(root, "enter", function () {
      if (root.closing_timer) {
        clearTimeout(root.closing_timer)
      }
    })

    // insert before checking position
    const ownerDocument = (options.event?.target as Node).ownerDocument
    const root_document = ownerDocument || document

    if (root_document.fullscreenElement)
      root_document.fullscreenElement.appendChild(root)
    else
      root_document.body.appendChild(root)

    // compute best position
    let left = options.left || 0
    let top = options.top || 0
    if (options.event) {
      left = options.event.clientX - 10
      top = options.event.clientY - 10
      if (options.title) top -= 20

      if (parent) {
        const rect = parent.root.getBoundingClientRect()
        left = rect.left + rect.width
      }

      const body_rect = document.body.getBoundingClientRect()
      const root_rect = root.getBoundingClientRect()
      if (body_rect.height == 0)
        console.error("document.body height is 0. That is dangerous, set html,body { height: 100%; }")

      if (body_rect.width && left > body_rect.width - root_rect.width - 10)
        left = body_rect.width - root_rect.width - 10
      if (body_rect.height && top > body_rect.height - root_rect.height - 10)
        top = body_rect.height - root_rect.height - 10
    }

    root.style.left = left + "px"
    root.style.top = top + "px"

    if (options.scale) root.style.transform = `scale(${options.scale})`
  }

  addItem(
    name: string,
    value: IContextMenuValue | string,
    options: IContextMenuOptions,
  ): HTMLElement {
    options ||= {}

    const element: ContextMenuDivElement = document.createElement("div")
    element.className = "litemenu-entry submenu"

    let disabled = false

    if (value === null) {
      element.classList.add("separator")
    } else {
      if (typeof value === "string") {
        element.innerHTML = name
      } else {
        element.innerHTML = value?.title ?? name

        if (value.disabled) {
          disabled = true
          element.classList.add("disabled")
          element.setAttribute("aria-disabled", "true")
        }
        if (value.submenu || value.has_submenu) {
          element.classList.add("has_submenu")
          element.setAttribute("aria-haspopup", "true")
          element.setAttribute("aria-expanded", "false")
        }
        if (value.className) element.className += " " + value.className
      }
      element.value = value
      element.setAttribute("role", "menuitem")

      if (typeof value === "function") {
        element.dataset["value"] = name
        element.onclick_callback = value
      } else {
        element.dataset["value"] = String(value)
      }
    }

    this.root.appendChild(element)
    if (!disabled) element.addEventListener("click", inner_onclick)
    if (!disabled && options.autoopen)
      LiteGraph.pointerListenerAdd(element, "enter", inner_over)

    const setAriaExpanded = () => {
      const entries = this.root.querySelectorAll("div.litemenu-entry.has_submenu")
      if (entries) {
        for (let i = 0; i < entries.length; i++) {
          entries[i].setAttribute("aria-expanded", "false")
        }
      }
      element.setAttribute("aria-expanded", "true")
    }

    function inner_over(this: ContextMenuDivElement, e: MouseEvent) {
      const value = this.value
      if (!value || !(value as IContextMenuValue).has_submenu) return

      // if it is a submenu, autoopen like the item was clicked
      inner_onclick.call(this, e)
      setAriaExpanded()
    }

    // menu option clicked
    const that = this
    function inner_onclick(this: ContextMenuDivElement, e: MouseEvent) {
      const value = this.value
      let close_parent = true

      that.current_submenu?.close(e)
      if (
        (value as IContextMenuValue)?.has_submenu ||
        (value as IContextMenuValue)?.submenu
      ) {
        setAriaExpanded()
      }

      // global callback
      if (options.callback) {
        const r = options.callback.call(
          this,
          value,
          options,
          e,
          that,
          options.node,
        )
        if (r === true) close_parent = false
      }

      // special cases
      if (typeof value === "object") {
        if (
          value.callback &&
          !options.ignore_item_callbacks &&
          value.disabled !== true
        ) {
          // item callback
          const r = value.callback.call(
            this,
            value,
            options,
            e,
            that,
            options.extra,
          )
          if (r === true) close_parent = false
        }
        if (value.submenu) {
          if (!value.submenu.options) throw "ContextMenu submenu needs options"

          new that.constructor(value.submenu.options, {
            callback: value.submenu.callback,
            event: e,
            parentMenu: that,
            ignore_item_callbacks: value.submenu.ignore_item_callbacks,
            title: value.submenu.title,
            extra: value.submenu.extra,
            autoopen: options.autoopen,
          })
          close_parent = false
        }
      }

      if (close_parent && !that.lock) that.close()
    }

    return element
  }

  close(e?: MouseEvent, ignore_parent_menu?: boolean): void {
    this.root.parentNode?.removeChild(this.root)
    if (this.parentMenu && !ignore_parent_menu) {
      this.parentMenu.lock = false
      this.parentMenu.current_submenu = null
      if (e === undefined) {
        this.parentMenu.close()
      } else if (e && !ContextMenu.isCursorOverElement(e, this.parentMenu.root)) {
        ContextMenu.trigger(
          this.parentMenu.root,
          LiteGraph.pointerevents_method + "leave",
          e,
        )
      }
    }
    this.current_submenu?.close(e, true)

    if (this.root.closing_timer) clearTimeout(this.root.closing_timer)
  }

  // this code is used to trigger events easily (used in the context menu mouseleave
  static trigger(
    element: HTMLDivElement,
    event_name: string,
    params: MouseEvent,
    origin?: unknown,
  ): CustomEvent {
    const evt = document.createEvent("CustomEvent")
    evt.initCustomEvent(event_name, true, true, params) // canBubble, cancelable, detail
    // @ts-expect-error
    evt.srcElement = origin
    if (element.dispatchEvent) element.dispatchEvent(evt)
    // @ts-expect-error
    else if (element.__events) element.__events.dispatchEvent(evt)
    // else nothing seems binded here so nothing to do
    return evt
  }

  // returns the top most menu
  getTopMenu(): ContextMenu {
    return this.options.parentMenu
      ? this.options.parentMenu.getTopMenu()
      : this
  }

  getFirstEvent(): MouseEvent {
    return this.options.parentMenu
      ? this.options.parentMenu.getFirstEvent()
      : this.options.event
  }

  static isCursorOverElement(
    event: MouseEvent,
    element: HTMLDivElement,
  ): boolean {
    const left = event.clientX
    const top = event.clientY
    const rect = element.getBoundingClientRect()
    if (!rect) return false

    if (
      top > rect.top &&
      top < rect.top + rect.height &&
      left > rect.left &&
      left < rect.left + rect.width
    ) {
      return true
    }
    return false
  }
}
