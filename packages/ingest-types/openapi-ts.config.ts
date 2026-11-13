import { defineConfig } from '@hey-api/openapi-ts'
import type { IR, Plugins } from '@hey-api/openapi-ts'

type ZodObjectResolver = NonNullable<Plugins.Zod.Resolvers['object']>
type ObjectResolverContext = Parameters<ZodObjectResolver>[0]

function definitionQuery(ref: string) {
  return {
    artifact: 'zod',
    category: 'schema',
    resource: 'definition',
    resourceId: ref
  }
}

function lazyReference(
  ctx: ObjectResolverContext,
  property: IR.SchemaObject
): string | undefined {
  return property.$ref !== undefined &&
    !ctx.plugin.isSymbolRegistered(definitionQuery(property.$ref))
    ? property.$ref
    : undefined
}

function typeLazyReferences(
  ctx: ObjectResolverContext
): ReturnType<ZodObjectResolver> {
  const properties: Record<string, IR.SchemaObject> =
    ctx.schema.properties ?? {}
  if (
    !Object.values(properties).some((property) => lazyReference(ctx, property))
  )
    return undefined

  const { z } = ctx.plugin.imports
  ctx.nodes.shape(ctx)
  const shape = ctx.$.object().pretty()
  Object.entries(properties).forEach(([name, property], index) => {
    const result = ctx._childResults[index]
    const optional = !ctx.schema.required?.includes(name)
    const ref = lazyReference(ctx, property)
    const chain =
      ref === undefined
        ? result.chain
        : ctx
            .$(z)
            .attr('lazy')
            .call(
              ctx.$.func()
                .returns(
                  ctx.$.type(z)
                    .attr('ZodType')
                    .generic(
                      ctx.plugin.referenceSymbol({
                        category: 'type',
                        resource: 'definition',
                        resourceId: ref
                      })
                    )
                )
                .do(
                  ctx
                    .$(ctx.plugin.referenceSymbol(definitionQuery(ref)))
                    .return()
                )
            )
    shape.prop(
      name,
      ctx.applyModifiers({ ...result, chain }, { optional }).chain
    )
  })
  return ctx.$(z).attr('object').call(shape)
}

export default defineConfig({
  input: process.env.INGEST_OPENAPI_SOURCE ?? './openapi.yaml',
  output: {
    path: './src',
    clean: true
  },
  parser: {
    filters: {
      operations: {
        exclude: [
          // Webhooks are server-to-server, not called by frontend
          '/\\/api\\/webhooks\\//',
          // Internal analytics endpoint
          '/\\/api\\/internal\\//'
        ]
      }
    }
  },
  plugins: [
    '@hey-api/typescript',
    {
      name: 'zod',
      compatibilityVersion: 4,
      definitions: true,
      requests: true,
      responses: true,
      $resolvers: {
        object: typeLazyReferences
      }
    }
  ]
})
