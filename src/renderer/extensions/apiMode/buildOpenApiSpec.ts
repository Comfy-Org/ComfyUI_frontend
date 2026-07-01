/**
 * Build an OpenAPI 3 spec describing a ComfyUI workflow's HTTP API, derived from
 * the workflow's App/API configuration (the `linearData` inputs/outputs).
 *
 * Mirrors the bundled `comfyui_api_mode` custom node: each promoted widget input
 * becomes a typed request-body field (with enum/min/max constraints) and the
 * selected output nodes shape the response. The generated spec is rendered with
 * Swagger UI when the workflow is viewed in API mode.
 */

export type ApiInputType = 'INT' | 'FLOAT' | 'STRING' | 'BOOLEAN' | 'COMBO'

export interface ApiInputSpec {
  /** API field name (the promoted widget's display name). */
  name: string
  type: ApiInputType
  default?: unknown
  /** Allowed values for COMBO inputs. */
  options?: unknown[]
  minimum?: number
  maximum?: number
  /** Where this value lives in the graph, e.g. "node 7.text". */
  description?: string
}

export interface BuildOpenApiSpecParams {
  title: string
  inputs: ApiInputSpec[]
  /** Selected output node ids/titles. */
  outputs: string[]
}

type JsonSchema = Record<string, unknown>

function inputToSchema(spec: ApiInputSpec): JsonSchema {
  const schema: JsonSchema = {}
  switch (spec.type) {
    case 'INT':
      schema.type = 'integer'
      break
    case 'FLOAT':
      schema.type = 'number'
      break
    case 'BOOLEAN':
      schema.type = 'boolean'
      break
    case 'COMBO':
      schema.type = 'string'
      if (spec.options && spec.options.length) schema.enum = [...spec.options]
      break
    case 'STRING':
    default:
      schema.type = 'string'
      break
  }
  if (spec.minimum !== undefined) schema.minimum = spec.minimum
  if (spec.maximum !== undefined) schema.maximum = spec.maximum
  if (spec.default !== undefined) schema.default = spec.default
  if (spec.description) schema.description = spec.description
  return schema
}

const INPUT_DESCRIPTOR_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'API field name.' },
    type: {
      type: 'string',
      enum: ['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO']
    },
    value: { description: 'Current value in the workflow.' },
    default: { description: 'Default value.' },
    options: {
      type: 'array',
      items: {},
      description: 'Allowed values for COMBO inputs.'
    },
    minimum: { type: 'number' },
    maximum: { type: 'number' },
    description: {
      type: 'string',
      description: 'Where this value lives in the graph.'
    }
  }
}

const OUTPUT_ITEM_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    filename: { type: 'string' },
    subfolder: { type: 'string' },
    type: { type: 'string' },
    url: { type: 'string', description: 'URL that streams the generated asset' }
  }
}

export function buildOpenApiSpec({
  title,
  inputs,
  outputs
}: BuildOpenApiSpecParams): Record<string, unknown> {
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []
  for (const input of inputs) {
    properties[input.name] = inputToSchema(input)
    if (input.default === undefined) required.push(input.name)
  }

  const requestSchema: JsonSchema = {
    type: 'object',
    properties
  }
  if (required.length) requestSchema.required = required

  const outputsSchema: JsonSchema =
    outputs.length > 0
      ? {
          type: 'object',
          description: 'Outputs keyed by source node id.',
          properties: Object.fromEntries(
            outputs.map((nodeId) => [
              nodeId,
              { type: 'array', items: OUTPUT_ITEM_SCHEMA }
            ])
          )
        }
      : { type: 'object', additionalProperties: true }

  return {
    openapi: '3.0.3',
    info: {
      title: `${title} API`,
      version: '1.0.0',
      description:
        'Auto-generated from the workflow API configuration (linearData). ' +
        'Run the workflow by POSTing the inputs below.'
    },
    paths: {
      '/api/workflow/inputs': {
        get: {
          summary: `Describe the "${title}" workflow inputs`,
          operationId: 'describeInputs',
          tags: [title],
          description:
            'Returns the workflow inputs (with their current values and ' +
            'constraints) and the selected output nodes.',
          responses: {
            '200': {
              description: 'The workflow inputs and their current values.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      inputs: {
                        type: 'array',
                        items: INPUT_DESCRIPTOR_SCHEMA
                      },
                      outputs: { type: 'array', items: { type: 'string' } }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/workflow/generate': {
        post: {
          summary: `Run the "${title}" workflow`,
          operationId: 'generate',
          tags: [title],
          requestBody: {
            required: inputs.length > 0,
            content: {
              'application/json': { schema: requestSchema }
            }
          },
          responses: {
            '200': {
              description: 'Workflow executed successfully.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      prompt_id: { type: 'string' },
                      outputs: outputsSchema
                    }
                  }
                }
              }
            },
            '502': { description: 'ComfyUI rejected or failed the prompt.' }
          }
        }
      }
    }
  }
}
