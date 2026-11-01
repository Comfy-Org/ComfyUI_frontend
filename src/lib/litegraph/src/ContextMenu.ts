import DOMPurify from 'dompurify'

import type {
  ContextMenuDivElement,
  IContextMenuOptions,
  IContextMenuValue
} from './types/contextMenu'
import { litegraph } from './litegraphInstance'

const HOVER_OPEN_DELAY_MS = 150

const ALLOWED_TAGS = ['span', 'b', 'i', 'em', 'strong']
const ALLOWED_STYLE_PROPS = new Set([
  'display',
  'color',
  'background-color',
  'padding-left',
  'border-left'
])

const menuSanitizer = DOMPurify(window)

menuSanitizer.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName === 'style') {
    const sanitizedStyle = data.attrValue
      .split(';')
      .map((s) => s.trim())
      .filter((s) => {
        const colonIdx = s.indexOf(':')
        if (colonIdx === -1) return false
        const prop = s.slice(0, colonIdx).trim().toLowerCase()
        return ALLOWED_STYLE_PROPS.has(prop)
      })
      .join('; ')
    data.attrValue = sanitizedStyle
  }
})

function sanitizeMenuHTML(html: string): string {
  return menuSanitizer.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['style']
  })
}

// TODO: Replace this pattern with something more modern.
export interface ContextMenu<TValue = unknown> {
  constructor: new (
    ...args: ConstructorParameters<typeof ContextMenu<TValue>>
  ) => ContextMenu<TValue>
}

/**
 * ContextMenu from LiteGUI
 */

export class ContextMenu<TValue = unknown> {
  options: IContextMenuOptions<TValue>
  parentMenu?: ContextMenu<TValue>
  root: ContextMenuDivElement<TValue>
  current_submenu?: ContextMenu<TValue>
  lock?: boolean
  private opensLeft = false
  private submenuEntry?: HTMLElement
  private hoverTimer?: ReturnType<typeof setTimeout>

  controller: AbortController = new AbortController()

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
  constructor(
    values: readonly (string | IContextMenuValue<TValue> | null)[],
    options: IContextMenuOptions<TValue> = {}
  ) {
    this.options = options

    const parent = options.parentMenu
    if (parent) {
      if (!(parent instanceof ContextMenu)) {
        console.error('parentMenu must be of class ContextMenu, ignoring it')
        options.parentMenu = undefined
      } else {
        this.parentMenu = parent
        this.parentMenu.lock = true
        this.parentMenu.current_submenu = this
      }
      if (parent.options.className === 'dark') {
        options.className = 'dark'
      }
    }

    const eventClass = options.event ? options.event.constructor.name : null
    if (
      eventClass !== 'MouseEvent' &&
      eventClass !== 'CustomEvent' &&
      eventClass !== 'PointerEvent'
    ) {
      console.error(
        `Event passed to ContextMenu is not of type MouseEvent or CustomEvent. Ignoring it. (${eventClass})`
      )
      options.event = undefined
    }

    const root: ContextMenuDivElement<TValue> = document.createElement('div')
    let classes = 'litegraph litecontextmenu litemenubar-panel'
    if (options.className) classes += ` ${options.className}`
    root.className = classes
    root.style.minWidth = '100'
    root.style.minHeight = '100'

    const { signal } = this.controller
    const eventOptions = { capture: true, signal }

    if (!this.parentMenu) {
      document.addEventListener(
        'pointerdown',
        (e) => {
          if (e.target instanceof Node && !this.containsNode(e.target)) {
            this.close()
          }
        },
        eventOptions
      )
    }

    root.addEventListener('pointerup', (e) => e.preventDefault(), eventOptions)

    root.addEventListener(
      'contextmenu',
      (e) => {
        if (e.button === 2) e.preventDefault()
      },
      eventOptions
    )

    root.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button == 2) {
          this.close()
          e.preventDefault()
        }
      },
      eventOptions
    )

    this.root = root

    if (options.title) {
      const element = document.createElement('div')
      element.className = 'litemenu-title'
      element.textContent = options.title
      root.append(element)
    }

    for (let i = 0; i < values.length; i++) {
      const value = values[i]
      let name = Array.isArray(values) ? value : String(i)

      if (typeof name !== 'string') {
        name =
          name != null
            ? name.content === undefined
              ? String(name)
              : name.content
            : name
      }

      this.addItem(name, value, options)
    }

    const ownerDocument = (options.event?.target as Node | null | undefined)
      ?.ownerDocument
    const root_document = ownerDocument || document

    if (root_document.fullscreenElement)
      root_document.fullscreenElement.append(root)
    else root_document.body.append(root)

    let left = options.left || 0
    let top = options.top || 0
    if (options.event) {
      left = options.event.clientX - 10
      top = options.event.clientY - 10
      if (options.title) top -= 20

      if (parent) {
        const rect = parent.root.getBoundingClientRect()
        const { width } = root.getBoundingClientRect()
        this.opensLeft =
          parent.opensLeft || rect.right + width > window.innerWidth
        left = this.opensLeft ? Math.max(0, rect.left - width) : rect.right
      }

      const body_rect = document.body.getBoundingClientRect()
      const root_rect = root.getBoundingClientRect()
      if (body_rect.height == 0)
        console.error(
          'document.body height is 0. That is dangerous, set html,body { height: 100%; }'
        )

      if (
        !parent &&
        body_rect.width &&
        left > body_rect.width - root_rect.width - 10
      )
        left = body_rect.width - root_rect.width - 10
      if (body_rect.height && top > body_rect.height - root_rect.height - 10)
        top = body_rect.height - root_rect.height - 10
    }

    root.style.left = `${left}px`
    root.style.top = `${top}px`

    if (litegraph().context_menu_scaling && options.scale) {
      root.style.transform = `scale(${Math.round(options.scale * 4) * 0.25})`
    }
  }

  /**
   * Checks if {@link node} is inside this context menu or any of its submenus
   * @param node The {@link Node} to check
   * @param visited A set of visited menus to avoid circular references
   * @returns `true` if {@link node} is inside this context menu or any of its submenus
   */
  containsNode(node: Node, visited: Set<this> = new Set()): boolean {
    if (visited.has(this)) return false
    visited.add(this)

    return (
      this.current_submenu?.containsNode(node, visited) ||
      this.root.contains(node)
    )
  }

  addItem(
    name: string | null,
    value: string | IContextMenuValue<TValue> | null,
    options: IContextMenuOptions<TValue> = {}
  ): HTMLElement {
    const element: ContextMenuDivElement<TValue> = document.createElement('div')
    element.className = 'litemenu-entry submenu'

    let disabled = false

    if (value === null) {
      element.classList.add('separator')
    } else {
      const label = name ?? ''
      if (typeof value === 'string') {
        element.textContent = label
      } else {
        const hasHtmlContent =
          value.content !== undefined && /<[a-z][\s\S]*>/i.test(value.content)
        if (hasHtmlContent) {
          element.innerHTML = sanitizeMenuHTML(value.content!)
        } else {
          element.textContent = value.title ?? label
        }

        if (value.disabled) {
          disabled = true
          element.classList.add('disabled')
          element.setAttribute('aria-disabled', 'true')
        }
        if (value.submenu || value.has_submenu) {
          element.classList.add('has_submenu')
          element.setAttribute('aria-haspopup', 'true')
          element.setAttribute('aria-expanded', 'false')
        }
        if (value.className) element.className += ` ${value.className}`
      }
      element.value = value
      element.setAttribute('role', 'menuitem')

      if (typeof value === 'function') {
        element.dataset['value'] = String(name)
        element.onclick_callback = value
      } else {
        element.dataset['value'] = String(value)
      }
    }

    const setAriaExpanded = () => {
      const entries = this.root.querySelectorAll(
        'div.litemenu-entry.has_submenu'
      )
      for (const entry of entries) {
        entry.setAttribute('aria-expanded', 'false')
      }
      element.setAttribute('aria-expanded', 'true')
    }

    const inner_onclick = (e: MouseEvent) => {
      const value = element.value
      let close_parent = true

      if (this.current_submenu && this.submenuEntry === element) return
      this.current_submenu?.close(e)
      if (
        (value as IContextMenuValue).has_submenu ||
        (value as IContextMenuValue).submenu
      ) {
        setAriaExpanded()
      }

      if (options.callback) {
        const r = options.callback.call(
          element,
          value,
          options,
          e,
          this,
          options.node
        )
        if (r === true) close_parent = false
      }

      if (typeof value === 'object') {
        if (
          value.callback &&
          !options.ignore_item_callbacks &&
          value.disabled !== true
        ) {
          const r = value.callback.call(
            element,
            value,
            options,
            e,
            this,
            options.extra
          )
          if (r === true) close_parent = false
        }
        if (value.submenu) {
          new this.constructor(value.submenu.options, {
            callback: value.submenu.callback,
            event: e,
            parentMenu: this,
            ignore_item_callbacks: value.submenu.ignore_item_callbacks,
            title: value.submenu.title,
            extra: value.submenu.extra,
            autoopen: options.autoopen
          })
          close_parent = false
        }
      }

      if (this.current_submenu) this.submenuEntry = element
      if (close_parent && !this.lock) this.close()
    }

    const inner_over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      clearTimeout(this.hoverTimer)
      this.hoverTimer = setTimeout(() => {
        if (
          !disabled &&
          (element.value as IContextMenuValue | null)?.has_submenu
        )
          inner_onclick(e)
        else this.current_submenu?.close(e)
      }, HOVER_OPEN_DELAY_MS)
    }

    this.root.append(element)
    if (!disabled) element.addEventListener('click', inner_onclick)
    if (options.autoopen) {
      element.addEventListener('pointerenter', inner_over)
      element.addEventListener('pointerleave', () =>
        clearTimeout(this.hoverTimer)
      )
    }

    return element
  }

  close(e?: MouseEvent, ignore_parent_menu?: boolean): void {
    clearTimeout(this.hoverTimer)
    this.controller.abort()
    this.root.remove()
    if (this.parentMenu && !ignore_parent_menu) {
      this.parentMenu.lock = false
      this.parentMenu.current_submenu = undefined
      if (e === undefined) {
        this.parentMenu.close()
      } else if (!ContextMenu.isCursorOverElement(e, this.parentMenu.root)) {
        ContextMenu.trigger(
          this.parentMenu.root,
          `${litegraph().pointerevents_method}leave`,
          e
        )
      }
    }
    this.current_submenu?.close(e, true)
  }

  /** @deprecated Likely unused, however code search was inconclusive (too many results to check by hand). */
  // this code is used to trigger events easily (used in the context menu mouseleave
  static trigger(
    element: HTMLDivElement,
    event_name: string,
    params: MouseEvent
  ): CustomEvent {
    const evt = document.createEvent('CustomEvent')
    evt.initCustomEvent(event_name, true, true, params)
    element.dispatchEvent(evt)
    // else nothing seems bound here so nothing to do
    return evt
  }

  // returns the top most menu
  getTopMenu(): ContextMenu<TValue> {
    return this.options.parentMenu ? this.options.parentMenu.getTopMenu() : this
  }

  getFirstEvent(): MouseEvent | undefined {
    return this.options.parentMenu
      ? this.options.parentMenu.getFirstEvent()
      : this.options.event
  }

  /** @deprecated Unused. */
  static isCursorOverElement(
    event: MouseEvent,
    element: HTMLDivElement
  ): boolean {
    const left = event.clientX
    const top = event.clientY
    const rect = element.getBoundingClientRect()
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

type RegisteredContextMenu<TValue = unknown> = ContextMenu<TValue>

declare module '@comfyorg/graph-model/entityRegistry' {
  interface ContextMenu<
    _TValue = unknown
  > extends RegisteredContextMenu<_TValue> {}
}
