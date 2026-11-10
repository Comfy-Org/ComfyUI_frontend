const MAX_REPLACEMENTS = 3

const QUANTIZATION_TAG = new RegExp(
  String.raw`(?<![a-z0-9])(?:` +
    [
      String.raw`(?:nv|mx)?fp\d+(?:[_-]?e\d+m\d+(?:fn)?(?:uz)?)?`,
      String.raw`e\d+m\d+(?:fn)?(?:uz)?`,
      String.raw`bf16`,
      String.raw`f(?:16|32)`,
      String.raw`u?int\d+`,
      String.raw`nf4`,
      String.raw`w\d+a\d+`,
      String.raw`i?q\d+(?:_(?:k|\d|xxs|xs|nl|s|m|l))*`,
      String.raw`gptq|awq|bnb|svdq|convrot|scaled|mixed|quant(?:ized)?`
    ].join('|') +
    String.raw`)(?![a-z0-9])`,
  'g'
)

function baseName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path
}

function stem(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

function variantKey(path: string): string {
  return stem(baseName(path).toLowerCase())
    .replace(QUANTIZATION_TAG, ' ')
    .split(/[^a-z0-9.]+/)
    .map((part) => part.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean)
    .join('_')
}

/**
 * Available options likely meant by a missing model value: the same file in
 * another folder first, then the same model at a different quantization.
 */
export function findModelReplacements(
  missingName: string,
  options: readonly (string | number)[]
): string[] {
  const missingBaseName = baseName(missingName).toLowerCase()
  const missingVariantKey = variantKey(missingName)
  const available = options.filter(
    (option): option is string =>
      typeof option === 'string' && option !== missingName
  )

  const sameFile = available.filter(
    (option) => baseName(option).toLowerCase() === missingBaseName
  )
  const sameModel = missingVariantKey
    ? available.filter(
        (option) =>
          !sameFile.includes(option) && variantKey(option) === missingVariantKey
      )
    : []

  return [...sameFile, ...sameModel].slice(0, MAX_REPLACEMENTS)
}
