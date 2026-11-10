const MAX_REPLACEMENTS = 3

const QUANTIZATION_TAG = new RegExp(
  String.raw`(?<![a-z0-9])(?:` +
    [
      String.raw`(?:nv|mx)?fp\d+(?:[_-]?e\d+m\d+(?:fn)?(?:uz)?)?(?:mixed|scaled)?`,
      String.raw`e\d+m\d+(?:fn)?(?:uz)?`,
      String.raw`bf16`,
      String.raw`f(?:16|32)`,
      String.raw`u?int\d+(?:mixed|scaled)?`,
      String.raw`\d+bit`,
      String.raw`nf4`,
      String.raw`w\d+a\d+`,
      String.raw`a\d+w\d+`,
      String.raw`[it]?q\d+(?:[_-](?:k|\d|xxs|xs|nl|s|m|l))*`,
      String.raw`gptq|awq|bnb|svdq|convrot|scaled|mixed|quant(?:ized)?`
    ].join('|') +
    String.raw`)(?![a-z0-9])`,
  'g'
)

interface ModelPath {
  fileName: string
  folder: string
  variantKey: string
}

const parsedOptions = new WeakMap<readonly (string | number)[], ModelPath[]>()

function parseModelPath(path: string): ModelPath {
  const parts = path.toLowerCase().replace(/\\/g, '/').split('/')
  const fileName = parts.pop() ?? ''
  const dot = fileName.lastIndexOf('.')
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName
  const extension = dot > 0 ? fileName.slice(dot) : ''
  const stemKey = stem
    .replace(QUANTIZATION_TAG, ' ')
    .split(/[^a-z0-9.]+/)
    .map((part) => part.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean)
    .join('_')
  return {
    fileName,
    folder: parts.at(-1) ?? '',
    variantKey: stemKey && stemKey + extension
  }
}

function parseOptions(options: readonly (string | number)[]): ModelPath[] {
  const cached = parsedOptions.get(options)
  if (cached) return cached
  const parsed = options.map((option) => parseModelPath(String(option)))
  parsedOptions.set(options, parsed)
  return parsed
}

function isSameFolderOrUnfoldered(a: ModelPath, b: ModelPath): boolean {
  return !a.folder || !b.folder || a.folder === b.folder
}

/**
 * Available options likely meant by a missing model value: the same file in
 * another folder first, then the same model at a different quantization.
 */
export function findModelReplacements(
  missingName: string,
  options: readonly (string | number)[]
): string[] {
  const missing = parseModelPath(missingName)
  const parsed = parseOptions(options)
  const candidates = options.flatMap((option, index) =>
    typeof option === 'string' &&
    option !== missingName &&
    isSameFolderOrUnfoldered(missing, parsed[index])
      ? [{ option, path: parsed[index] }]
      : []
  )

  const sameFile = candidates.filter(
    ({ path }) => path.fileName === missing.fileName
  )
  const sameModel = missing.variantKey
    ? candidates.filter(
        ({ path }) =>
          path.fileName !== missing.fileName &&
          path.variantKey === missing.variantKey
      )
    : []

  return [
    ...new Set([...sameFile, ...sameModel].map(({ option }) => option))
  ].slice(0, MAX_REPLACEMENTS)
}
