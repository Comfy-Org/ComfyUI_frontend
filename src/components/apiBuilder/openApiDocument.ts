import type { ApiParameter, ApiSpec } from './apiSpec'
import { API_BASE_URL, isMediaParameter } from './apiSpec'

type JsonRecord = Record<string, unknown>

function parameterSchema(parameter: ApiParameter): JsonRecord {
  if (isMediaParameter(parameter)) {
    return {
      type: 'string',
      format: 'uri',
      description: `${
        parameter.type.charAt(0).toUpperCase() + parameter.type.slice(1)
      } input — an HTTPS URL or a base64 data URI`
    }
  }

  const schema: JsonRecord = { type: parameter.type }
  if (parameter.defaultValue !== undefined)
    schema.default = parameter.defaultValue
  if (parameter.minimum !== undefined) schema.minimum = parameter.minimum
  if (parameter.maximum !== undefined) schema.maximum = parameter.maximum
  if (parameter.enumValues) schema.enum = parameter.enumValues
  if (parameter.nodeTitle) schema.description = parameter.nodeTitle
  return schema
}

const outputAssetSchema: JsonRecord = {
  type: 'object',
  properties: {
    filename: { type: 'string' },
    url: { type: 'string', format: 'uri' }
  }
}

function jobSchema(spec: ApiSpec): JsonRecord {
  return {
    type: 'object',
    properties: {
      job_id: { type: 'string' },
      status: {
        type: 'string',
        enum: ['queued', 'running', 'completed', 'failed']
      },
      outputs: {
        type: 'object',
        properties: Object.fromEntries(
          spec.outputs.map((output) => [
            output.key,
            {
              type: 'array',
              items: { $ref: '#/components/schemas/OutputAsset' },
              description: output.title
            }
          ])
        )
      }
    }
  }
}

export function buildOpenApiDocument(spec: ApiSpec): JsonRecord {
  const required = spec.parameters
    .filter((parameter) => parameter.required)
    .map((parameter) => parameter.name)

  const inputSchema: JsonRecord = {
    type: 'object',
    properties: Object.fromEntries(
      spec.parameters.map((parameter) => [
        parameter.name,
        parameterSchema(parameter)
      ])
    ),
    ...(required.length ? { required } : {})
  }

  return {
    openapi: '3.1.0',
    info: { title: spec.title, version: '1.0.0' },
    servers: [{ url: API_BASE_URL }],
    paths: {
      [`/workflows/${spec.workflowId}/run`]: {
        post: {
          operationId: 'submitJob',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Input' }
              }
            }
          },
          responses: {
            '202': {
              description: 'Job accepted',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Job' }
                }
              }
            }
          }
        }
      },
      '/jobs/{job_id}': {
        get: {
          operationId: 'getJob',
          parameters: [
            {
              name: 'job_id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': {
              description: 'Job status and outputs',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Job' }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Input: inputSchema,
        Job: jobSchema(spec),
        OutputAsset: outputAssetSchema
      }
    }
  }
}
