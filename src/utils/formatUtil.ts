import { ResultItem } from '@/schemas/apiSchema'

export function formatCamelCase(str: string): string {
  // Check if the string is camel case
  const isCamelCase = /^([A-Z][a-z]*)+$/.test(str)

  if (!isCamelCase) {
    return str // Return original string if not camel case
  }

  // Split the string into words, keeping acronyms together
  const words = str.split(/(?=[A-Z][a-z])|\d+/)

  // Process each word
  const processedWords = words.map((word) => {
    // If the word is all uppercase and longer than one character, it's likely an acronym
    if (word.length > 1 && word === word.toUpperCase()) {
      return word // Keep acronyms as is
    }
    // For other words, ensure the first letter is capitalized
    return word.charAt(0).toUpperCase() + word.slice(1)
  })

  // Join the words with spaces
  return processedWords.join(' ')
}

export function appendJsonExt(path: string) {
  if (!path.toLowerCase().endsWith('.json')) {
    path += '.json'
  }
  return path
}

export function trimJsonExt(path?: string) {
  return path?.replace(/\.json$/, '')
}

export function highlightQuery(text: string, query: string) {
  if (!query) return text
  const regex = new RegExp(`(${query})`, 'gi')
  return text.replace(regex, '<span class="highlight">$1</span>')
}

export function formatNumberWithSuffix(
  num: number,
  {
    precision = 1,
    roundToInt = false
  }: { precision?: number; roundToInt?: boolean } = {}
): string {
  const suffixes = ['', 'k', 'm', 'b', 't']
  const absNum = Math.abs(num)

  if (absNum < 1000) {
    return roundToInt ? Math.round(num).toString() : num.toFixed(precision)
  }

  const exp = Math.min(Math.floor(Math.log10(absNum) / 3), suffixes.length - 1)
  const formattedNum = (num / Math.pow(1000, exp)).toFixed(precision)

  return `${formattedNum}${suffixes[exp]}`
}

export function formatSize(value?: number) {
  if (value === null || value === undefined) {
    return '-'
  }

  const bytes = value
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Finds the common directory prefix between two paths
 * @example
 * findCommonPrefix('a/b/c', 'a/b/d') // returns 'a/b'
 * findCommonPrefix('x/y/z', 'a/b/c') // returns ''
 * findCommonPrefix('a/b/c', 'a/b/c/d') // returns 'a/b/c'
 */
export function findCommonPrefix(path1: string, path2: string): string {
  const parts1 = path1.split('/')
  const parts2 = path2.split('/')

  const commonParts: string[] = []
  for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
    if (parts1[i] === parts2[i]) {
      commonParts.push(parts1[i])
    } else {
      break
    }
  }
  return commonParts.join('/')
}

/**
 * Returns various filename components.
 * Example:
 * - fullFilename: 'file.txt'
 * - filename: 'file'
 * - suffix: 'txt'
 */
export function getFilenameDetails(fullFilename: string) {
  if (fullFilename.includes('.')) {
    return {
      filename: fullFilename.split('.').slice(0, -1).join('.'),
      suffix: fullFilename.split('.').pop() ?? null
    }
  } else {
    return { filename: fullFilename, suffix: null }
  }
}

/**
 * Returns various path components.
 * Example:
 * - path: 'dir/file.txt'
 * - directory: 'dir'
 * - fullFilename: 'file.txt'
 * - filename: 'file'
 * - suffix: 'txt'
 */
export function getPathDetails(path: string) {
  const directory = path.split('/').slice(0, -1).join('/')
  const fullFilename = path.split('/').pop() ?? path
  return { directory, fullFilename, ...getFilenameDetails(fullFilename) }
}

/**
 * Normalizes a string to be used as an i18n key.
 * Replaces dots with underscores.
 */
export function normalizeI18nKey(key: string) {
  return typeof key === 'string' ? key.replace(/\./g, '_') : ''
}

/**
 * Takes a dynamic prompt in the format {opt1|opt2|{optA|optB}|} and randomly replaces groups. Supports C style comments.
 * @param input The dynamic prompt to process
 * @returns
 */
export function processDynamicPrompt(input: string): string {
  /*
   * Strips C-style line and block comments from a string
   */
  function stripComments(str: string) {
    return str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
  }

  let i = 0
  let result = ''
  input = stripComments(input)

  const handleEscape = () => {
    const nextChar = input[i++]
    return '\\' + nextChar
  }

  function parseChoiceBlock() {
    // Parse the content inside {}
    const options: string[] = []
    let choice = ''
    let depth = 0

    while (i < input.length) {
      const char = input[i++]

      if (char === '\\') {
        choice += handleEscape()
        continue
      } else if (char === '{') {
        depth++
      } else if (char === '}') {
        if (!depth) break
        depth--
      } else if (char === '|') {
        if (!depth) {
          options.push(choice)
          choice = ''
          continue
        }
      }
      choice += char
    }

    options.push(choice)

    const chosenOption = options[Math.floor(Math.random() * options.length)]
    return processDynamicPrompt(chosenOption)
  }

  while (i < input.length) {
    const char = input[i++]
    if (char === '\\') {
      result += handleEscape()
    } else if (char === '{') {
      result += parseChoiceBlock()
    } else {
      result += char
    }
  }

  return result.replace(/\\([{}|])/g, '$1')
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
const hasAnnotation = (filepath: string): boolean =>
  /\[(input|output|temp)\]/i.test(filepath)

const createAnnotation = (filepath: string, rootFolder = 'input'): string =>
  !hasAnnotation(filepath) && rootFolder !== 'input' ? ` [${rootFolder}]` : ''

const createPath = (filename: string, subfolder = ''): string =>
  subfolder ? `${subfolder}/${filename}` : filename

/** Creates annotated filepath in format used by folder_paths.py */
export function createAnnotatedPath(
  item: string | ResultItem,
  options: { rootFolder?: string; subfolder?: string } = {}
): string {
  const { rootFolder = 'input', subfolder } = options
  if (typeof item === 'string')
    return `${createPath(item, subfolder)}${createAnnotation(item, rootFolder)}`
  return `${createPath(item.filename ?? '', item.subfolder)}${
    item.type ? createAnnotation(item.type, rootFolder) : ''
  }`
}

/**
 * Parses a filepath into its filename and subfolder components.
 *
 * @example
 * parseFilePath('folder/file.txt')    // → { filename: 'file.txt', subfolder: 'folder' }
 * parseFilePath('/folder/file.txt')   // → { filename: 'file.txt', subfolder: 'folder' }
 * parseFilePath('file.txt')           // → { filename: 'file.txt', subfolder: '' }
 * parseFilePath('folder//file.txt')   // → { filename: 'file.txt', subfolder: 'folder' }
 *
 * @param filepath The filepath to parse
 * @returns Object containing filename and subfolder
 */
export function parseFilePath(filepath: string): {
  filename: string
  subfolder: string
} {
  if (!filepath?.trim()) return { filename: '', subfolder: '' }

  const normalizedPath = filepath
    .replace(/[\\/]+/g, '/') // Normalize path separators
    .replace(/^\//, '') // Remove leading slash
    .replace(/\/$/, '') // Remove trailing slash

  const lastSlashIndex = normalizedPath.lastIndexOf('/')

  if (lastSlashIndex === -1) {
    return {
      filename: normalizedPath,
      subfolder: ''
    }
  }

  return {
    filename: normalizedPath.slice(lastSlashIndex + 1),
    subfolder: normalizedPath.slice(0, lastSlashIndex)
  }
}

// Simple date formatter
const parts = {
  d: (d: Date) => d.getDate(),
  M: (d: Date) => d.getMonth() + 1,
  h: (d: Date) => d.getHours(),
  m: (d: Date) => d.getMinutes(),
  s: (d: Date) => d.getSeconds()
}
const format =
  Object.keys(parts)
    .map((k) => k + k + '?')
    .join('|') + '|yyy?y?'

export function formatDate(text: string, date: Date) {
  return text.replace(new RegExp(format, 'g'), (text: string): string => {
    if (text === 'yy') return (date.getFullYear() + '').substring(2)
    if (text === 'yyyy') return date.getFullYear().toString()
    if (text[0] in parts) {
      const p = parts[text[0] as keyof typeof parts](date)
      return (p + '').padStart(text.length, '0')
    }
    return text
  })
}

/**
 * Generate a cache key from parameters
 * Sorts the parameters to ensure consistent keys regardless of parameter order
 */
export const paramsToCacheKey = (params: unknown): string => {
  if (typeof params === 'string') return params
  if (typeof params === 'object' && params !== null)
    return Object.keys(params)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => `${key}:${params[key as keyof typeof params]}`)
      .join('&')

  return String(params)
}

/**
 * Generates a RFC4122 compliant UUID v4 using the native crypto API when available
 * @returns A properly formatted UUID string
 */
export const generateUUID = (): string => {
  // Use native crypto.randomUUID() if available (modern browsers)
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  // Fallback implementation for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Checks if a URL is a Civitai model URL
 * @example
 * isCivitaiModelUrl('https://civitai.com/api/download/models/1234567890') // true
 * isCivitaiModelUrl('https://civitai.com/api/v1/models/1234567890') // true
 * isCivitaiModelUrl('https://civitai.com/api/v1/models-versions/15342') // true
 * isCivitaiModelUrl('https://example.com/model.safetensors') // false
 */
export const isCivitaiModelUrl = (url: string): boolean => {
  if (!isValidUrl(url)) return false
  if (!url.includes('civitai.com')) return false

  const urlObj = new URL(url)
  const pathname = urlObj.pathname

  return (
    /^\/api\/download\/models\/(\d+)$/.test(pathname) ||
    /^\/api\/v1\/models\/(\d+)$/.test(pathname) ||
    /^\/api\/v1\/models-versions\/(\d+)$/.test(pathname)
  )
}

/**
 * Converts a Hugging Face download URL to a repository page URL
 * @param url The download URL to convert
 * @returns The repository page URL or the original URL if conversion fails
 * @example
 * downloadUrlToHfRepoUrl(
 *  'https://huggingface.co/bfl/FLUX.1/resolve/main/flux1-canny-dev.safetensors?download=true'
 * ) // https://huggingface.co/bfl/FLUX.1
 */
export const downloadUrlToHfRepoUrl = (url: string): string => {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname

    // Use regex to match everything before /resolve/ or /blob/
    const regex = /^(.*?)(?:\/resolve\/|\/blob\/|$)/
    const repoPathMatch = regex.exec(pathname)

    // Extract the repository path and remove leading slash if present
    const repoPath = repoPathMatch?.[1]?.replace(/^\//, '') || ''

    return `https://huggingface.co/${repoPath}`
  } catch (error) {
    return url
  }
}

export const isSemVer = (version: string) => {
  const regex = /^(\d+)\.(\d+)\.(\d+)$/
  return regex.test(version)
}

const normalizeVersion = (version: string) =>
  version
    .split(/[+.-]/)
    .map(Number)
    .filter((part) => !Number.isNaN(part))

export function compareVersions(
  versionA: string | undefined,
  versionB: string | undefined
): number {
  versionA ??= '0.0.0'
  versionB ??= '0.0.0'

  const aParts = normalizeVersion(versionA)
  const bParts = normalizeVersion(versionB)

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] ?? 0
    const bPart = bParts[i] ?? 0
    if (aPart < bPart) return -1
    if (aPart > bPart) return 1
  }

  return 0
}

/**
 * Converts a currency amount to Metronome's integer representation.
 * For USD, converts to cents (multiplied by 100).
 * For all other currencies (including custom pricing units), returns the amount as is.
 * This is specific to Metronome's API requirements.
 *
 * @param amount - The amount in currency to convert
 * @param currency - The currency to convert
 * @returns The amount in Metronome's integer format (cents for USD, base units for others)
 * @example
 * toMetronomeCurrency(1.23, 'usd') // returns 123 (cents)
 * toMetronomeCurrency(1000, 'jpy') // returns 1000 (yen)
 */
export function toMetronomeCurrency(amount: number, currency: string): number {
  if (currency === 'usd') {
    return Math.round(amount * 100)
  }
  return amount
}

/**
 * Converts Metronome's integer amount back to a formatted currency string.
 * For USD, converts from cents to dollars.
 * For all other currencies (including custom pricing units), returns the amount as is.
 * This is specific to Metronome's API requirements.
 *
 * @param amount - The amount in Metronome's integer format (cents for USD, base units for others)
 * @param currency - The currency to convert
 * @returns The formatted amount in currency with 2 decimal places for USD
 * @example
 * formatMetronomeCurrency(123, 'usd') // returns "1.23" (cents to USD)
 * formatMetronomeCurrency(1000, 'jpy') // returns "1000" (yen)
 */
export function formatMetronomeCurrency(
  amount: number,
  currency: string
): string {
  if (currency === 'usd') {
    return (amount / 100).toFixed(2)
  }
  return amount.toString()
}

/**
 * Converts a USD amount to microdollars (1/1,000,000 of a dollar).
 * This conversion is commonly used in financial systems to avoid floating-point precision issues
 * by representing monetary values as integers.
 *
 * @param usd - The amount in US dollars to convert
 * @returns The amount in microdollars (multiplied by 1,000,000)
 * @example
 * usdToMicros(1.23) // returns 1230000
 */
export function usdToMicros(usd: number): number {
  return Math.round(usd * 1_000_000)
}

/**
 * Converts URLs in a string to HTML links.
 * @param text - The string to convert
 * @returns The string with URLs converted to HTML links
 * @example
 * linkifyHtml('Visit https://example.com for more info') // returns 'Visit <a href="https://example.com" target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:underline">https://example.com</a> for more info'
 */
export function linkifyHtml(text: string): string {
  if (!text) return ''
  const urlRegex =
    /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%?=~_|])|(\bwww\.[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%?=~_|])/gi
  return text.replace(urlRegex, (_match, p1, _p2, p3) => {
    const url = p1 || p3
    const href = p3 ? `http://${url}` : url
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:underline">${url}</a>`
  })
}

/**
 * Converts newline characters to HTML <br> tags.
 * @param text - The string to convert
 * @returns The string with newline characters converted to <br> tags
 * @example
 * nl2br('Hello\nWorld') // returns 'Hello<br />World'
 */
export function nl2br(text: string): string {
  if (!text) return ''
  return text.replace(/\n/g, '<br />')
}
