import { z } from 'zod'

export const ROLES = [
  'domain',
  'application',
  'infrastructure',
  'presentation',
  'integration'
] as const

export type ArchitecturalRole = (typeof ROLES)[number]

export const ROLE_DEPENDENCIES: Record<
  ArchitecturalRole,
  readonly ArchitecturalRole[]
> = {
  domain: ['domain'],
  application: ['application', 'domain', 'infrastructure'],
  infrastructure: ['application', 'domain', 'infrastructure'],
  presentation: ['application', 'domain', 'presentation'],
  integration: ROLES
}

const text = z.string().trim().min(1)

const uniqueList = <T extends z.ZodString>(item: T, minimum = 0) =>
  z
    .array(item)
    .min(minimum)
    .refine((items) => new Set(items).size === items.length, {
      message: 'must not contain duplicates'
    })

const sourcePath = z
  .string()
  .regex(
    /^src\/[^*?[\]{}]+?(\/\*\*)?$/,
    'must be a src/ file or a src/ directory ending in /**'
  )

export const domainRecordSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    capability: text,
    description: text,
    modules: z
      .array(z.object({ path: sourcePath, role: z.enum(ROLES) }).strict())
      .min(1),
    publicEntryPoints: uniqueList(sourcePath),
    allowedDependencies: uniqueList(text),
    allowedConsumers: uniqueList(text),
    characterizationScenarios: z
      .array(z.object({ name: text, checks: uniqueList(text, 1) }).strict())
      .min(1),
    adrs: uniqueList(z.string().regex(/^docs\/adr\/[^/]+\.md$/)),
    compatibilityPromises: uniqueList(text, 1),
    deepImports: z.enum(['enforced', 'inventory'])
  })
  .strict()

export const exceptionLedgerSchema = z
  .object({
    exceptions: z.array(
      z
        .object({
          id: z.string().regex(/^DDD-EX-\d{3}$/),
          owner: z.string().regex(/^@\S+$/),
          rationale: text,
          sunset: z.string().date(),
          removalCriteria: text,
          exactFingerprints: uniqueList(text, 1)
        })
        .strict()
    )
  })
  .strict()

export type DomainRecord = z.infer<typeof domainRecordSchema>
export type ArchitectureException = z.infer<
  typeof exceptionLedgerSchema
>['exceptions'][number]
