import type {
  ComfyNodeDefLatest,
  ComfyNodeDefV1,
  ComfyNodeDefV1_2,
  ComfyNodeDefV3
} from './versionTransforms'

/**
 * Proxy-based system for synchronizing data between different API versions
 */
export class VersionProxies {
  private static canonicalStore = new Map<string, ComfyNodeDefLatest>()
  private static eventBus = new EventTarget()

  /**
   * Register a canonical node definition
   */
  static registerCanonicalNode(nodeId: string, nodeData: ComfyNodeDefLatest) {
    this.canonicalStore.set(nodeId, nodeData)
  }

  /**
   * Get canonical node data
   */
  static getCanonicalNode(nodeId: string): ComfyNodeDefLatest | undefined {
    return this.canonicalStore.get(nodeId)
  }

  /**
   * Create a V1 proxy for a node
   */
  static createV1Proxy(nodeId: string): ComfyNodeDefV1 {
    const canonical = this.canonicalStore.get(nodeId)
    if (!canonical) {
      throw new Error(`Node ${nodeId} not found in canonical store`)
    }

    return new Proxy({} as ComfyNodeDefV1, {
      get(target, prop: keyof ComfyNodeDefV1) {
        return VersionProxies.transformCanonicalToV1Property(canonical, prop)
      },

      set(target, prop: keyof ComfyNodeDefV1, value) {
        VersionProxies.transformV1PropertyToCanonical(canonical, prop, value)
        VersionProxies.notifyChange(nodeId, prop, value)
        return true
      },

      has(target, prop: keyof ComfyNodeDefV1) {
        return (
          prop in canonical ||
          prop === 'input' ||
          prop === 'output' ||
          prop === 'output_is_list'
        )
      },

      ownKeys(target) {
        return [
          'name',
          'display_name',
          'description',
          'category',
          'output_node',
          'input',
          'output',
          'output_is_list',
          'python_module'
        ]
      },

      getOwnPropertyDescriptor(target, prop) {
        return {
          enumerable: true,
          configurable: true,
          value: this.get!(target, prop, target)
        }
      }
    })
  }

  /**
   * Create a V1.2 proxy for a node
   */
  static createV1_2Proxy(nodeId: string): ComfyNodeDefV1_2 {
    const canonical = this.canonicalStore.get(nodeId)
    if (!canonical) {
      throw new Error(`Node ${nodeId} not found in canonical store`)
    }

    return new Proxy({} as ComfyNodeDefV1_2, {
      get(target, prop: keyof ComfyNodeDefV1_2) {
        return VersionProxies.transformCanonicalToV1_2Property(canonical, prop)
      },

      set(target, prop: keyof ComfyNodeDefV1_2, value) {
        VersionProxies.transformV1_2PropertyToCanonical(canonical, prop, value)
        VersionProxies.notifyChange(nodeId, prop, value)
        return true
      },

      has(target, prop: keyof ComfyNodeDefV1_2) {
        return (
          prop in canonical ||
          prop === 'input' ||
          prop === 'output' ||
          prop === 'output_is_list' ||
          prop === 'inputs' ||
          prop === 'metadata'
        )
      },

      ownKeys(target) {
        return [
          'name',
          'display_name',
          'description',
          'category',
          'output_node',
          'input',
          'output',
          'output_is_list',
          'inputs',
          'metadata',
          'python_module'
        ]
      },

      getOwnPropertyDescriptor(target, prop) {
        return {
          enumerable: true,
          configurable: true,
          value: this.get!(target, prop, target)
        }
      }
    })
  }

  /**
   * Create a V3 proxy for a node
   */
  static createV3Proxy(nodeId: string): ComfyNodeDefV3 {
    const canonical = this.canonicalStore.get(nodeId)
    if (!canonical) {
      throw new Error(`Node ${nodeId} not found in canonical store`)
    }

    return new Proxy({} as ComfyNodeDefV3, {
      get(target, prop: keyof ComfyNodeDefV3) {
        return VersionProxies.transformCanonicalToV3Property(canonical, prop)
      },

      set(target, prop: keyof ComfyNodeDefV3, value) {
        VersionProxies.transformV3PropertyToCanonical(canonical, prop, value)
        VersionProxies.notifyChange(nodeId, prop, value)
        return true
      },

      has(target, prop: keyof ComfyNodeDefV3) {
        return (
          prop in canonical ||
          prop === 'schema' ||
          prop === 'inputs' ||
          prop === 'outputs'
        )
      },

      ownKeys(target) {
        return [
          'name',
          'display_name',
          'description',
          'category',
          'output_node',
          'schema',
          'inputs',
          'outputs',
          'python_module'
        ]
      },

      getOwnPropertyDescriptor(target, prop) {
        return {
          enumerable: true,
          configurable: true,
          value: this.get!(target, prop, target)
        }
      }
    })
  }

  /**
   * Transform canonical property to V1 format
   */
  private static transformCanonicalToV1Property(
    canonical: ComfyNodeDefLatest,
    prop: keyof ComfyNodeDefV1
  ): any {
    switch (prop) {
      case 'input':
        return canonical.input
          ? {
              required: canonical.input.required,
              optional: canonical.input.optional
            }
          : undefined
      case 'output':
        return canonical.output
      case 'output_is_list':
        return canonical.output_is_list
      case 'name':
      case 'display_name':
      case 'description':
      case 'category':
      case 'output_node':
      case 'python_module':
        return canonical[prop]
      default:
        return undefined
    }
  }

  /**
   * Transform canonical property to V1.2 format
   */
  private static transformCanonicalToV1_2Property(
    canonical: ComfyNodeDefLatest,
    prop: keyof ComfyNodeDefV1_2
  ): any {
    switch (prop) {
      case 'inputs':
        if (!canonical.input) return undefined
        return [
          ...Object.entries(canonical.input.required || {}).map(
            ([name, spec]) => ({
              name,
              type: this.inferTypeFromSpec(spec),
              required: true,
              spec,
              options: Array.isArray(spec) ? spec : undefined
            })
          ),
          ...Object.entries(canonical.input.optional || {}).map(
            ([name, spec]) => ({
              name,
              type: this.inferTypeFromSpec(spec),
              required: false,
              spec,
              options: Array.isArray(spec) ? spec : undefined
            })
          )
        ]
      case 'metadata':
        return {
          version: canonical.api_version,
          author: 'Unknown',
          description: canonical.description
        }
      default:
        return this.transformCanonicalToV1Property(
          canonical,
          prop as keyof ComfyNodeDefV1
        )
    }
  }

  /**
   * Transform canonical property to V3 format
   */
  private static transformCanonicalToV3Property(
    canonical: ComfyNodeDefLatest,
    prop: keyof ComfyNodeDefV3
  ): any {
    switch (prop) {
      case 'schema': {
        const requiredInputs = Object.keys(canonical.input?.required || {})
        return {
          type: 'object',
          properties: {
            ...(canonical.input?.required || {}),
            ...(canonical.input?.optional || {})
          },
          required: requiredInputs
        }
      }
      case 'inputs': {
        if (!canonical.input) return []
        const requiredInputs2 = Object.entries(canonical.input.required || {})
        const optionalInputs = Object.entries(canonical.input.optional || {})
        return [
          ...requiredInputs2.map(([name, spec]) => ({
            name,
            type: this.inferTypeFromSpec(spec),
            required: true,
            schema: spec
          })),
          ...optionalInputs.map(([name, spec]) => ({
            name,
            type: this.inferTypeFromSpec(spec),
            required: false,
            schema: spec
          }))
        ]
      }
      case 'outputs':
        return (
          canonical.output?.map((type, index) => ({
            name: `output_${index}`,
            type,
            is_list: canonical.output_is_list?.[index] || false
          })) || []
        )
      case 'name':
      case 'display_name':
      case 'description':
      case 'category':
      case 'output_node':
      case 'python_module':
        return canonical[prop]
      default:
        return undefined
    }
  }

  /**
   * Transform V1 property changes back to canonical format
   */
  private static transformV1PropertyToCanonical(
    canonical: ComfyNodeDefLatest,
    prop: keyof ComfyNodeDefV1,
    value: any
  ): void {
    switch (prop) {
      case 'input':
        canonical.input = value
          ? {
              required: value.required,
              optional: value.optional
            }
          : undefined
        break
      case 'output':
        canonical.output = value
        break
      case 'output_is_list':
        canonical.output_is_list = value
        break
      case 'name':
      case 'display_name':
      case 'description':
      case 'category':
      case 'output_node':
      case 'python_module':
        ;(canonical as any)[prop] = value
        break
    }
  }

  /**
   * Transform V1.2 property changes back to canonical format
   */
  private static transformV1_2PropertyToCanonical(
    canonical: ComfyNodeDefLatest,
    prop: keyof ComfyNodeDefV1_2,
    value: any
  ): void {
    switch (prop) {
      case 'inputs':
        if (Array.isArray(value)) {
          const required: Record<string, any> = {}
          const optional: Record<string, any> = {}

          value.forEach((input) => {
            if (input.required) {
              required[input.name] = input.spec
            } else {
              optional[input.name] = input.spec
            }
          })

          canonical.input = {
            required: Object.keys(required).length > 0 ? required : undefined,
            optional: Object.keys(optional).length > 0 ? optional : undefined
          }
        }
        break
      case 'metadata':
        if (value && typeof value === 'object') {
          canonical.api_version = value.version
          canonical.description = value.description || canonical.description
        }
        break
      default:
        this.transformV1PropertyToCanonical(
          canonical,
          prop as keyof ComfyNodeDefV1,
          value
        )
    }
  }

  /**
   * Transform V3 property changes back to canonical format
   */
  private static transformV3PropertyToCanonical(
    canonical: ComfyNodeDefLatest,
    prop: keyof ComfyNodeDefV3,
    value: any
  ): void {
    switch (prop) {
      case 'schema':
        if (value && typeof value === 'object') {
          const required: Record<string, any> = {}
          const optional: Record<string, any> = {}

          Object.entries(value.properties || {}).forEach(([name, spec]) => {
            if (value.required?.includes(name)) {
              required[name] = spec
            } else {
              optional[name] = spec
            }
          })

          canonical.input = {
            required: Object.keys(required).length > 0 ? required : undefined,
            optional: Object.keys(optional).length > 0 ? optional : undefined
          }
        }
        break
      case 'inputs':
        if (Array.isArray(value)) {
          const required: Record<string, any> = {}
          const optional: Record<string, any> = {}

          value.forEach((input) => {
            if (input.required) {
              required[input.name] = input.schema
            } else {
              optional[input.name] = input.schema
            }
          })

          canonical.input = {
            required: Object.keys(required).length > 0 ? required : undefined,
            optional: Object.keys(optional).length > 0 ? optional : undefined
          }
        }
        break
      case 'outputs':
        if (Array.isArray(value)) {
          canonical.output = value.map((output) => output.type)
          canonical.output_is_list = value.map((output) => output.is_list)
        }
        break
      case 'name':
      case 'display_name':
      case 'description':
      case 'category':
      case 'output_node':
      case 'python_module':
        ;(canonical as any)[prop] = value
        break
    }
  }

  /**
   * Notify about data changes
   */
  private static notifyChange(nodeId: string, prop: string, value: any): void {
    this.eventBus.dispatchEvent(
      new CustomEvent('nodedef-changed', {
        detail: { nodeId, prop, value }
      })
    )
  }

  /**
   * Add event listener for data changes
   */
  static addEventListener(type: string, listener: EventListener): void {
    this.eventBus.addEventListener(type, listener)
  }

  /**
   * Remove event listener
   */
  static removeEventListener(type: string, listener: EventListener): void {
    this.eventBus.removeEventListener(type, listener)
  }

  /**
   * Infer type from input specification
   */
  private static inferTypeFromSpec(spec: any): string {
    if (Array.isArray(spec)) {
      return 'combo'
    }

    if (typeof spec === 'object' && spec !== null) {
      if (spec.type) {
        return spec.type
      }
      if (spec[0] === 'INT') {
        return 'int'
      }
      if (spec[0] === 'FLOAT') {
        return 'float'
      }
      if (spec[0] === 'STRING') {
        return 'string'
      }
      if (spec[0] === 'BOOLEAN') {
        return 'boolean'
      }
    }

    return 'unknown'
  }
}
