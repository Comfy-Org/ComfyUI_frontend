import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

// Type definitions for different API versions
export interface ComfyNodeDefV1 {
  name: string
  display_name?: string
  description?: string
  category?: string
  output_node?: boolean
  input?: {
    required?: Record<string, any>
    optional?: Record<string, any>
  }
  output?: string[]
  output_is_list?: boolean[]
  python_module?: string
}

export interface ComfyNodeDefV1_2 extends ComfyNodeDefV1 {
  inputs?: Array<{
    name: string
    type: string
    required: boolean
    options?: any
    spec?: any
  }>
  metadata?: {
    version?: string
    author?: string
    description?: string
  }
}

export interface ComfyNodeDefV3 {
  name: string
  display_name?: string
  description?: string
  category?: string
  output_node?: boolean
  schema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
  inputs: Array<{
    name: string
    type: string
    required: boolean
    schema: any
  }>
  outputs: Array<{
    name: string
    type: string
    is_list: boolean
  }>
  python_module?: string
}

// Use current ComfyNodeDef as the canonical format
export type ComfyNodeDefLatest = ComfyNodeDef

/**
 * Transforms node definitions between different API versions
 */
export class VersionTransforms {
  /**
   * Transform API responses to all supported versions
   */
  static transformToAllVersions(currentData: any, v3Data: any = null) {
    // Use current data as canonical since it's our primary source
    const canonical = currentData || {}

    return {
      canonical,
      v1: this.canonicalToV1(canonical),
      v1_2: this.canonicalToV1_2(canonical),
      v3: v3Data || this.canonicalToV3(canonical)
    }
  }

  /**
   * Transform canonical format to v1 format
   */
  static canonicalToV1(
    canonical: Record<string, ComfyNodeDefLatest>
  ): Record<string, ComfyNodeDefV1> {
    const v1Nodes: Record<string, ComfyNodeDefV1> = {}

    for (const [nodeName, nodeData] of Object.entries(canonical)) {
      v1Nodes[nodeName] = {
        name: nodeData.name,
        display_name: nodeData.display_name,
        description: nodeData.description,
        category: nodeData.category,
        output_node: nodeData.output_node,
        python_module: nodeData.python_module,
        input: nodeData.input
          ? {
              required: nodeData.input.required,
              optional: nodeData.input.optional
            }
          : undefined,
        output: nodeData.output,
        output_is_list: nodeData.output_is_list
      }
    }

    return v1Nodes
  }

  /**
   * Transform canonical format to v1.2 format
   */
  static canonicalToV1_2(
    canonical: Record<string, ComfyNodeDefLatest>
  ): Record<string, ComfyNodeDefV1_2> {
    const v1_2Nodes: Record<string, ComfyNodeDefV1_2> = {}

    for (const [nodeName, nodeData] of Object.entries(canonical)) {
      const v1Node = this.canonicalToV1({ [nodeName]: nodeData })[nodeName]

      v1_2Nodes[nodeName] = {
        ...v1Node,
        inputs: nodeData.input
          ? [
              ...Object.entries(nodeData.input.required || {}).map(
                ([name, spec]) => ({
                  name,
                  type: this.inferTypeFromSpec(spec),
                  required: true,
                  spec,
                  options: Array.isArray(spec) ? spec : undefined
                })
              ),
              ...Object.entries(nodeData.input.optional || {}).map(
                ([name, spec]) => ({
                  name,
                  type: this.inferTypeFromSpec(spec),
                  required: false,
                  spec,
                  options: Array.isArray(spec) ? spec : undefined
                })
              )
            ]
          : undefined,
        metadata: {
          version: nodeData.api_version,
          author: 'Unknown',
          description: nodeData.description
        }
      }
    }

    return v1_2Nodes
  }

  /**
   * Transform canonical format to v3 format
   */
  static canonicalToV3(
    canonical: Record<string, ComfyNodeDefLatest>
  ): Record<string, ComfyNodeDefV3> {
    const v3Nodes: Record<string, ComfyNodeDefV3> = {}

    for (const [nodeName, nodeData] of Object.entries(canonical)) {
      const requiredInputs = Object.keys(nodeData.input?.required || {})
      const optionalInputs = Object.keys(nodeData.input?.optional || {})

      v3Nodes[nodeName] = {
        name: nodeData.name,
        display_name: nodeData.display_name,
        description: nodeData.description,
        category: nodeData.category,
        output_node: nodeData.output_node,
        python_module: nodeData.python_module,
        schema: {
          type: 'object',
          properties: {
            ...(nodeData.input?.required || {}),
            ...(nodeData.input?.optional || {})
          },
          required: requiredInputs
        },
        inputs: [
          ...requiredInputs.map((name) => ({
            name,
            type: this.inferTypeFromSpec(nodeData.input!.required![name]),
            required: true,
            schema: nodeData.input!.required![name]
          })),
          ...optionalInputs.map((name) => ({
            name,
            type: this.inferTypeFromSpec(nodeData.input!.optional![name]),
            required: false,
            schema: nodeData.input!.optional![name]
          }))
        ],
        outputs:
          nodeData.output?.map((type, index) => ({
            name: `output_${index}`,
            type,
            is_list: nodeData.output_is_list?.[index] || false
          })) || []
      }
    }

    return v3Nodes
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

  /**
   * Merge current and v3 data to create canonical format
   */
  private static createCanonicalFormat(
    currentData: any,
    v3Data: any
  ): Record<string, ComfyNodeDefLatest> {
    // For now, use current data as canonical
    // In the future, we might merge v3 data for enhanced information
    return currentData || {}
  }
}
