import ts from 'typescript'

type DeliveryInput = {
  branch: string
  sameRepository: boolean
  changed: readonly string[]
  added: readonly string[]
  versionChanged: boolean
  appRegistry: string
  previousAppRegistry: string
  previousWebsiteRegistry: string
  websiteRegistry: string
}

function unwrap(expression: ts.Expression): ts.Expression {
  return ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)
    ? unwrap(expression.expression)
    : expression
}

function registryObject(source: string, name: string) {
  const file = ts.createSourceFile(
    'registry.ts',
    source,
    ts.ScriptTarget.Latest
  )
  const declaration = file.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find((entry) => ts.isIdentifier(entry.name) && entry.name.text === name)
  const expression = declaration?.initializer && unwrap(declaration.initializer)
  if (!expression || !ts.isObjectLiteralExpression(expression))
    throw new Error(`Cannot read ${name} from locale registry`)
  return expression.properties.map((property) => {
    if (
      !ts.isPropertyAssignment(property) ||
      (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))
    )
      throw new Error(`Unsupported property in ${name}`)
    return { name: property.name.text, value: unwrap(property.initializer) }
  })
}

function websitePublication(source: string) {
  const locales = registryObject(source, 'LOCALES')
    .map(({ name }) => name)
    .filter((locale) => locale !== 'en')
  const partial: Partial<Record<string, readonly string[]>> =
    Object.fromEntries(
      registryObject(source, 'PARTIAL_LOCALE_ROUTES').map(({ name, value }) => {
        const routes =
          ts.isNewExpression(value) &&
          ts.isIdentifier(value.expression) &&
          value.expression.text === 'Set' &&
          value.arguments?.[0]
        if (!routes || !ts.isArrayLiteralExpression(routes))
          throw new Error(`Cannot read published routes for ${name}`)
        return [
          name,
          routes.elements.map((route) => {
            if (!ts.isStringLiteral(route))
              throw new Error(`Unsupported published route for ${name}`)
            return route.text.replace(/\/+$/, '') || '/'
          })
        ]
      })
    )
  return { locales, partial }
}

export function catalogDeliveryPlan(input: DeliveryInput): {
  app: readonly string[] | 'all' | null
  website: readonly string[] | null
} {
  const generatedApp =
    input.changed.includes('src/locales/.source-manifest.json') ||
    (input.sameRepository &&
      input.branch.startsWith('update-locales-node-defs-'))
  const releaseApp =
    input.versionChanged ||
    (input.sameRepository && input.branch.startsWith('version-bump-'))
  const shipped = registryObject(input.appRegistry, 'localeDefinitions')
    .map(({ name }) => name)
    .filter((locale) => locale !== 'en')
  const previousShipped = registryObject(
    input.previousAppRegistry,
    'localeDefinitions'
  ).map(({ name }) => name)
  const launched = shipped.filter((locale) => !previousShipped.includes(locale))
  const app = generatedApp
    ? 'all'
    : releaseApp
      ? shipped
      : launched.length
        ? launched
        : null
  const current = websitePublication(input.websiteRegistry)
  const previous = websitePublication(input.previousWebsiteRegistry)
  const generatedWebsite =
    input.changed.includes('apps/website/src/locales/.source-manifest.json') ||
    (input.sameRepository && input.branch === 'bl/website-locale-updates')
  const launches = current.locales.filter((locale) => {
    if (!previous.locales.includes(locale)) return true
    const before = previous.partial[locale]
    const after = current.partial[locale]
    return (
      (before !== undefined &&
        (after === undefined ||
          after.some((route) => !before.includes(route)))) ||
      input.added.some(
        (path) =>
          path.startsWith(`apps/website/src/pages/${locale}/`) &&
          /\.(astro|mdx?|html)$/.test(path)
      )
    )
  })
  return {
    app,
    website: generatedWebsite
      ? current.locales
      : launches.length
        ? launches
        : null
  }
}
