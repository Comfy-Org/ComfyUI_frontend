import { watch } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { isDOMWidget } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

import { ComfyApiError } from './errors'
import type {
  OwnedElementBooleanProperty,
  OwnedElementEvent,
  OwnedElementEventDetail,
  OwnedElementHandle,
  OwnedElementNumberProperty,
  OwnedElementScope
} from './ownedElementHandle'
import type { Unsubscribe } from './widgetHandle'

const POLICY: Readonly<
  Partial<
    Record<
      string,
      {
        get: readonly string[]
        set: readonly string[]
        methods: readonly string[]
        events: readonly string[]
      }
    >
  >
> = {
  video: {
    get: [
      'currentTime',
      'duration',
      'paused',
      'ended',
      'videoWidth',
      'videoHeight',
      'readyState',
      'muted',
      'volume'
    ],
    set: ['currentTime', 'muted', 'volume', 'playbackRate', 'loop'],
    methods: ['play', 'pause', 'load'],
    events: [
      'timeupdate',
      'loadedmetadata',
      'loadeddata',
      'play',
      'pause',
      'ended',
      'seeked',
      'error'
    ]
  },
  audio: {
    get: [
      'currentTime',
      'duration',
      'paused',
      'ended',
      'readyState',
      'muted',
      'volume'
    ],
    set: ['currentTime', 'muted', 'volume', 'playbackRate', 'loop'],
    methods: ['play', 'pause', 'load'],
    events: [
      'timeupdate',
      'loadedmetadata',
      'loadeddata',
      'play',
      'pause',
      'ended',
      'seeked',
      'error'
    ]
  },
  img: {
    get: ['naturalWidth', 'naturalHeight', 'complete'],
    set: ['src', 'alt'],
    methods: [],
    events: ['load', 'error']
  },
  canvas: {
    get: ['width', 'height'],
    set: ['width', 'height'],
    methods: [],
    events: []
  },
  input: {
    get: ['value'],
    set: ['value'],
    methods: ['focus', 'select', 'click'],
    events: ['input', 'change']
  },
  textarea: {
    get: ['value', 'selectionStart', 'selectionEnd', 'scrollTop'],
    set: ['value', 'scrollTop'],
    methods: ['focus', 'select', 'setSelectionRange'],
    events: ['input', 'change']
  }
}

function boundedName(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 128 ||
    value.includes('\0')
  ) {
    throw new ComfyApiError(
      'Element names and scope fields must be bounded strings.'
    )
  }
}

function validateScope(
  value: unknown
): asserts value is OwnedElementScope | undefined {
  if (value === undefined) return
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !('nodeId' in value) ||
    !('widget' in value) ||
    Object.keys(value).some((key) => key !== 'nodeId' && key !== 'widget')
  ) {
    throw new ComfyApiError('Element scope must name a node and widget.')
  }
  boundedName(value.nodeId)
  boundedName(value.widget)
}

function boundedWrite(element: HTMLElement, property: string, value: unknown) {
  if (property === 'value' || property === 'src' || property === 'alt') {
    if (
      typeof value !== 'string' ||
      value.length > 262144 ||
      new TextEncoder().encode(value).length > 1048576
    ) {
      throw new ComfyApiError('Element text exceeds bounds.')
    }
    if (
      property === 'src' &&
      !/^(https?:|data:image\/(png|jpe?g|gif|webp|svg\+xml);|blob:)/i.test(
        value.trim()
      )
    ) {
      throw new ComfyApiError('Element source URL is not permitted.')
    }
    return
  }
  if (property === 'muted' || property === 'loop') {
    if (typeof value !== 'boolean')
      throw new ComfyApiError('Element value must be boolean.')
    return
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (property === 'scrollTop' && Math.abs(value) > 1000000) ||
    (property === 'volume' && (value < 0 || value > 1)) ||
    (property === 'playbackRate' && (value < 0.0625 || value > 16)) ||
    (property === 'currentTime' && value < 0)
  ) {
    throw new ComfyApiError('Element numeric value exceeds bounds.')
  }
  if (
    element instanceof HTMLCanvasElement &&
    (property === 'width' || property === 'height')
  ) {
    const other = property === 'width' ? element.height : element.width
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value > 8192 ||
      value * other > 16777216
    ) {
      throw new ComfyApiError('Canvas dimensions exceed bounds.')
    }
  }
}

export function createOwnedElementAccessor(
  getGraph: () => LGraph | null | undefined
) {
  return function element(
    name: string,
    scope?: OwnedElementScope
  ): OwnedElementHandle {
    boundedName(name)
    validateScope(scope)
    const store = useDomWidgetStore()
    const subscriptions = new Set<Unsubscribe>()
    let resolved: ReturnType<typeof resolve> | undefined
    let revoked = false
    let stopOwner: Unsubscribe | undefined
    let observer: MutationObserver | undefined

    function resolve() {
      const graph = getGraph()
      if (!graph) throw new ComfyApiError('No active graph.')
      const matches = [...store.widgetStates.values()].flatMap(({ widget }) => {
        if (
          !isDOMWidget(widget) ||
          widget.node.graph !== graph ||
          (scope &&
            (String(widget.node.id) !== scope.nodeId ||
              widget.name !== scope.widget))
        )
          return []
        const elements = [
          widget.element,
          ...widget.element.querySelectorAll<HTMLElement>(
            '[data-key], [data-name]'
          )
        ]
        return elements
          .filter(
            (candidate) =>
              candidate.getAttribute('data-key') === name ||
              candidate.getAttribute('data-name') === name
          )
          .filter((candidate) => POLICY[candidate.tagName.toLowerCase()])
          .map((candidate) => ({ graph, widget, element: candidate }))
      })
      if (matches.length !== 1)
        throw new ComfyApiError(
          matches.length
            ? 'Ambiguous element; specify nodeId and widget.'
            : 'Unknown element in mounted UI.'
        )
      return matches[0]
    }

    function revoke() {
      revoked = true
      stopOwner?.()
      observer?.disconnect()
      for (const stop of subscriptions) stop()
      subscriptions.clear()
    }

    function ownedElement() {
      if (revoked) throw new ComfyApiError('Element handle has been removed.')
      if (!resolved) {
        resolved = resolve()
        const { widget } = resolved
        stopOwner = watch(
          () => store.widgetStates.get(widget.id)?.widget,
          (current) => {
            if (current !== widget) revoke()
          },
          { flush: 'sync' }
        )
        observer = new MutationObserver(() => {
          if (resolved && !resolved.widget.element.contains(resolved.element))
            revoke()
        })
        observer.observe(widget.element, { childList: true, subtree: true })
      }
      const { widget, element, graph } = resolved
      if (
        store.widgetStates.get(widget.id)?.widget !== widget ||
        widget.node.graph !== graph ||
        graph.rootGraph !== getGraph()?.rootGraph ||
        !widget.element.contains(element)
      ) {
        revoke()
        throw new ComfyApiError('Element handle has been removed.')
      }
      return element
    }

    function permit(
      element: HTMLElement,
      operation: 'get' | 'set' | 'methods' | 'events',
      key: string
    ) {
      if (!POLICY[element.tagName.toLowerCase()]?.[operation].includes(key)) {
        throw new ComfyApiError(`Element operation '${key}' is not permitted.`)
      }
    }

    async function get(property: OwnedElementNumberProperty): Promise<number>
    async function get(property: OwnedElementBooleanProperty): Promise<boolean>
    async function get(property: 'value'): Promise<string>
    async function get(property: string): Promise<number | boolean | string> {
      const element = ownedElement()
      permit(element, 'get', property)
      const value: unknown = Reflect.get(element, property)
      if (
        typeof value !== 'number' &&
        typeof value !== 'boolean' &&
        typeof value !== 'string'
      ) {
        throw new ComfyApiError('Element property is not scalar.')
      }
      if (typeof value === 'string') boundedWrite(element, property, value)
      return value
    }

    async function set(
      property:
        | 'currentTime'
        | 'volume'
        | 'playbackRate'
        | 'width'
        | 'height'
        | 'scrollTop',
      value: number
    ): Promise<void>
    async function set(
      property: 'muted' | 'loop',
      value: boolean
    ): Promise<void>
    async function set(
      property: 'value' | 'src' | 'alt',
      value: string
    ): Promise<void>
    async function set(property: string, value: unknown) {
      const element = ownedElement()
      permit(element, 'set', property)
      if (
        (property === 'value' || property === 'src' || property === 'alt') &&
        typeof value !== 'string'
      ) {
        throw new ComfyApiError('Element value must be a string.')
      }
      boundedWrite(element, property, value)
      Reflect.set(element, property, value)
    }

    async function invoke(
      method: 'play' | 'pause' | 'load' | 'focus' | 'select' | 'click'
    ): Promise<void>
    async function invoke(
      method: 'setSelectionRange',
      start: number,
      end: number,
      direction?: 'forward' | 'backward' | 'none'
    ): Promise<void>
    async function invoke(method: string, ...args: unknown[]) {
      const element = ownedElement()
      permit(element, 'methods', method)
      if (
        method === 'setSelectionRange'
          ? args.length < 2 ||
            args.length > 3 ||
            args
              .slice(0, 2)
              .some(
                (value) =>
                  typeof value !== 'number' ||
                  !Number.isInteger(value) ||
                  value < 0 ||
                  value > 262144
              ) ||
            (args.length === 3 &&
              args[2] !== undefined &&
              !['forward', 'backward', 'none'].includes(String(args[2])))
          : args.length !== 0
      )
        throw new ComfyApiError('Element method arguments are invalid.')
      const methodFunction: unknown = Reflect.get(element, method)
      if (typeof methodFunction !== 'function')
        throw new ComfyApiError('Element method is unavailable.')
      await Reflect.apply(methodFunction, element, args)
      ownedElement()
    }

    async function listen(
      event: OwnedElementEvent,
      listener: (detail: OwnedElementEventDetail) => void
    ): Promise<Unsubscribe> {
      const element = ownedElement()
      permit(element, 'events', event)
      if (typeof listener !== 'function')
        throw new ComfyApiError('Element listener must be callable.')
      if (subscriptions.size >= 128)
        throw new ComfyApiError('Element subscription limit exceeded.')
      function onEvent() {
        try {
          ownedElement()
          const value: unknown = Reflect.get(element, 'value')
          if (typeof value === 'string') boundedWrite(element, 'value', value)
        } catch {
          return
        }
        const currentTime: unknown = Reflect.get(element, 'currentTime')
        const duration: unknown = Reflect.get(element, 'duration')
        const value: unknown = Reflect.get(element, 'value')
        listener({
          ...(typeof currentTime === 'number' ? { currentTime } : {}),
          ...(typeof duration === 'number' ? { duration } : {}),
          ...(typeof value === 'string' ? { value } : {})
        })
      }
      function stop() {
        element.removeEventListener(event, onEvent)
        subscriptions.delete(stop)
      }
      subscriptions.add(stop)
      element.addEventListener(event, onEvent)
      return stop
    }

    return Object.freeze({ get, set, invoke, listen })
  }
}
