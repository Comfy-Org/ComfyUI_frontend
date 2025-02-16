import { ResultItem } from '@/types/apiTypes'

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
  return key.replace(/\./g, '_')
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

const createAnnotation = (rootFolder = 'input'): string =>
  rootFolder !== 'input' ? ` [${rootFolder}]` : ''

const createPath = (filename: string, subfolder = ''): string =>
  subfolder ? `${subfolder}/${filename}` : filename

/** Creates annotated filepath in format used by folder_paths.py */
export function createAnnotatedPath(
  item: string | ResultItem,
  options: { rootFolder?: string; subfolder?: string } = {}
): string {
  const { rootFolder = 'input', subfolder } = options
  if (typeof item === 'string')
    return `${createPath(item, subfolder)}${createAnnotation(rootFolder)}`
  return `${createPath(item.filename ?? '', item.subfolder)}${createAnnotation(item.type)}`
}
