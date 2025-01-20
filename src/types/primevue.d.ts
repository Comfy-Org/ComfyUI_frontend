// Workaround for issue https://github.com/primefaces/primevue/issues/6722
declare module '@primevue/forms/resolvers/zod' {
  import type { Schema, ParseParams } from 'zod'
  import type { ResolverOptions, ResolverResult } from '@primevue/forms'

  export const zodResolver: <T extends Schema<any, any>>(
    schema: T,
    schemaOptions?: ParseParams,
    resolverOptions?: ResolverOptions
  ) => ({ values, name }: any) => Promise<ResolverResult<T>>
}
