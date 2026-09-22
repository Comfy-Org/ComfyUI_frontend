export const modelsSource = [
  'src/components/workshop/**',
  'src/components/models/**',
  'src/components/home/{WorkshopSection*,ModelDiscoverySection*,ModelReleaseSection*,modelDiscoveryProviders*}',
  'src/composables/useWorkshop*',
  'src/composables/useFrameRatioMismatch*',
  'src/config/{workshop*,model*,router*}',
  'src/content/workshop*',
  'src/data/modelDiscovery*',
  'src/integrations/workshop*',
  'src/lib/workshop/**',
  'src/routes/models/**',
  'src/scripts/workshop*'
]

export const modelsUnitTests = [
  ...modelsSource.map((path) =>
    path.endsWith('/**') ? `${path}/*.{test,spec}.ts` : `${path}.{test,spec}.ts`
  ),
  'scripts/{router-*,workshop-*,generate-workshop-*,generate-models*}.test.ts'
]

export const modelsBrowserTests =
  /\b(?:workshop[^\s/]*|models-[^\s/]*|header-models-navigation)\.spec\.ts\b|@models\b/

export function websiteTestScope(value: string | undefined) {
  if (value === undefined || value === 'all') return 'all'
  if (value === 'models' || value === 'website') return value
  throw new Error(`Unknown WEBSITE_TEST_SCOPE: ${value}`)
}

export function scopedBrowserTests(
  scope: ReturnType<typeof websiteTestScope>,
  grep?: RegExp
) {
  return scope === 'models'
    ? {
        grep: grep
          ? new RegExp(
              `(?=.*(?:${modelsBrowserTests.source}))(?=.*${grep.source})`
            )
          : modelsBrowserTests
      }
    : { grep, grepInvert: scope === 'website' ? modelsBrowserTests : undefined }
}
