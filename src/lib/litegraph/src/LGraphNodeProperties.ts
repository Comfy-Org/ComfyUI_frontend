import type { LGraphNode } from './LGraphNode'

type LGraphNodeWithDynamicProps = LGraphNode & Record<string, unknown>

/**
 * Default properties to track
 */
const DEFAULT_TRACKED_PROPERTIES: string[] = [
  'title',
  'flags.collapsed',
  'flags.pinned',
  'mode',
  'color',
  'bgcolor'
]
/**
 * Manages node properties with optional change tracking and instrumentation.
 */
export class LGraphNodeProperties {
  /** The node this property manager belongs to */
  node: LGraphNode

  /** Set of property paths that have been instrumented */
  #instrumentedPaths = new Set<string>()

  constructor(node: LGraphNode) {
    this.node = node

    this.#setupInstrumentation()
  }

  /**
   * Sets up property instrumentation for all tracked properties
   */
  #setupInstrumentation(): void {
    for (const path of DEFAULT_TRACKED_PROPERTIES) {
      this.#instrumentProperty(path)
    }
  }

  #resolveTargetObject(parts: string[]): {
    targetObject: Record<string, unknown>
    propertyName: string
  } {
    const node: LGraphNodeWithDynamicProps = this
      .node as LGraphNodeWithDynamicProps

    if (parts.length === 1) {
      return { targetObject: node, propertyName: parts[0] }
    }

    let targetObject: Record<string, unknown> = node
    for (let i = 0; i < parts.length - 1; i++) {
      targetObject = targetObject[parts[i]] as Record<string, unknown>
    }

    return {
      targetObject,
      propertyName: parts[parts.length - 1]
    }
  }

  /**
   * Instruments a single property to track changes
   */
  #instrumentProperty(path: string): void {
    const parts = path.split('.')

    if (parts.length > 1) {
      this.#ensureNestedPath(path)
    }

    const { targetObject, propertyName } = this.#resolveTargetObject(parts)

    const hasProperty = Object.prototype.hasOwnProperty.call(
      targetObject,
      propertyName
    )
    const currentValue = targetObject[propertyName]

    if (!hasProperty) {
      let value: unknown = undefined

      Object.defineProperty(targetObject, propertyName, {
        get: () => value,
        set: (newValue: unknown) => {
          const oldValue = value
          value = newValue
          this.#emitPropertyChange(path, oldValue, newValue)

          // Update enumerable: true for non-undefined values, false for undefined
          const shouldBeEnumerable = newValue !== undefined
          const currentDescriptor = Object.getOwnPropertyDescriptor(
            targetObject,
            propertyName
          )
          if (
            currentDescriptor &&
            currentDescriptor.enumerable !== shouldBeEnumerable
          ) {
            Object.defineProperty(targetObject, propertyName, {
              ...currentDescriptor,
              enumerable: shouldBeEnumerable
            })
          }
        },
        enumerable: false,
        configurable: true
      })
    } else {
      Object.defineProperty(
        targetObject,
        propertyName,
        this.#createInstrumentedDescriptor(path, currentValue)
      )
    }

    this.#instrumentedPaths.add(path)
  }

  /**
   * Creates a property descriptor that emits change events
   */
  #createInstrumentedDescriptor(
    propertyPath: string,
    initialValue: unknown
  ): PropertyDescriptor {
    return this.#createInstrumentedDescriptorTyped(propertyPath, initialValue)
  }

  #createInstrumentedDescriptorTyped<TValue>(
    propertyPath: string,
    initialValue: TValue
  ): PropertyDescriptor {
    let value: TValue = initialValue

    return {
      get: () => value,
      set: (newValue: TValue) => {
        const oldValue = value
        value = newValue
        this.#emitPropertyChange(propertyPath, oldValue, newValue)
      },
      enumerable: true,
      configurable: true
    }
  }

  /**
   * Emits a property change event if the node is connected to a graph
   */
  #emitPropertyChange(
    propertyPath: string,
    oldValue: unknown,
    newValue: unknown
  ): void {
    this.#emitPropertyChangeTyped(propertyPath, oldValue, newValue)
  }

  #emitPropertyChangeTyped<TValue>(
    propertyPath: string,
    oldValue: TValue,
    newValue: TValue
  ): void {
    this.node.graph?.trigger('node:property:changed', {
      nodeId: this.node.id,
      property: propertyPath,
      oldValue,
      newValue
    })
  }

  /**
   * Ensures parent objects exist for nested properties
   */
  #ensureNestedPath(path: string): void {
    const parts = path.split('.')
    const node: LGraphNodeWithDynamicProps = this
      .node as LGraphNodeWithDynamicProps
    let current: Record<string, unknown> = node

    // Create all parent objects except the last property
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!current[part]) {
        current[part] = {}
      }
      current = current[part] as Record<string, unknown>
    }
  }

  /**
   * Checks if a property is being tracked
   */
  isTracked(path: string): boolean {
    return this.#instrumentedPaths.has(path)
  }

  /**
   * Gets the list of tracked properties
   */
  getTrackedProperties(): string[] {
    return [...DEFAULT_TRACKED_PROPERTIES]
  }

  /**
   * Custom toJSON method for JSON.stringify
   * Returns undefined to exclude from serialization since we only use defaults
   */
  toJSON(): undefined {
    return undefined
  }
}
