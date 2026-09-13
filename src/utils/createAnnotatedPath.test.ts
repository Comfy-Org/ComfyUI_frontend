import { describe, expect, it } from 'vitest'

import type { ResultItem } from '@/schemas/apiSchema'
import {
  createAnnotatedPath,
  parseAnnotatedPath
} from '@/utils/createAnnotatedPath'

const resultItemCases = [
  {
    name: 'input',
    item: {
      filename: 'input.png',
      subfolder: 'nested',
      type: 'input'
    },
    expected: 'nested/input.png'
  },
  {
    name: 'temp',
    item: {
      filename: 'preview.png',
      subfolder: 'nested',
      type: 'temp'
    },
    expected: 'nested/preview.png [temp]'
  },
  {
    name: 'output',
    item: {
      filename: 'result.png',
      subfolder: 'nested',
      type: 'output'
    },
    expected: 'nested/result.png [output]'
  },
  {
    name: 'missing type',
    item: {
      filename: 'untyped.png',
      subfolder: 'nested'
    },
    expected: 'nested/untyped.png'
  },
  {
    name: 'existing annotation',
    item: {
      filename: 'preview.png [temp]',
      subfolder: 'nested',
      type: 'output'
    },
    expected: 'nested/preview.png [temp]'
  }
] satisfies { name: string; item: ResultItem; expected: string }[]

const stringCases = [
  {
    name: 'input root',
    filename: 'input.png',
    options: { rootFolder: 'input', subfolder: 'nested' },
    expected: 'nested/input.png'
  },
  {
    name: 'temp root',
    filename: 'preview.png',
    options: { rootFolder: 'temp', subfolder: 'nested' },
    expected: 'nested/preview.png [temp]'
  },
  {
    name: 'output root',
    filename: 'result.png',
    options: { rootFolder: 'output', subfolder: 'nested' },
    expected: 'nested/result.png [output]'
  },
  {
    name: 'existing annotation',
    filename: 'preview.png [temp]',
    options: { rootFolder: 'output' },
    expected: 'preview.png [temp]'
  }
] as const

describe('createAnnotatedPath', () => {
  it.for(resultItemCases)(
    'formats $name ResultItem paths from their own type',
    ({ item, expected }) => {
      expect(createAnnotatedPath(item)).toBe(expected)
    }
  )

  it.for(stringCases)(
    'formats string paths for $name',
    ({ filename, options, expected }) => {
      expect(createAnnotatedPath(filename, options)).toBe(expected)
    }
  )

  it('ignores caller options for the ResultItem form', () => {
    const item: ResultItem = {
      filename: 'result.png',
      subfolder: 'asset',
      type: 'output'
    }
    const callerOptions = { rootFolder: 'output' as const, subfolder: 'x' }

    // @ts-expect-error ResultItem paths intentionally reject caller options.
    const actual = createAnnotatedPath(item, callerOptions)
    expect(actual).toBe('asset/result.png [output]')
  })
})

const roundTripCases = [
  {
    path: 'nested/result.png [output]',
    filepath: 'nested/result.png',
    rootFolder: 'output'
  },
  {
    path: 'nested/preview.png [temp]',
    filepath: 'nested/preview.png',
    rootFolder: 'temp'
  },
  {
    path: 'nested/input.png',
    filepath: 'nested/input.png',
    rootFolder: 'input'
  },
  {
    path: 'a [output]/photo.png [temp]',
    filepath: 'a [output]/photo.png',
    rootFolder: 'temp'
  }
] as const

describe('parseAnnotatedPath', () => {
  it.for(roundTripCases)(
    'inverts createAnnotatedPath for $path',
    ({ path, filepath, rootFolder }) => {
      expect(parseAnnotatedPath(path)).toEqual({ filepath, rootFolder })
      expect(createAnnotatedPath(filepath, { rootFolder })).toBe(path)
    }
  )

  it('resolves an unannotated path to the fallback root', () => {
    expect(parseAnnotatedPath('photo.png', 'temp')).toEqual({
      filepath: 'photo.png',
      rootFolder: 'temp'
    })
  })

  it('lets the annotation win over the fallback root', () => {
    expect(parseAnnotatedPath('generated.png [output]', 'input')).toEqual({
      filepath: 'generated.png',
      rootFolder: 'output'
    })
  })
})
