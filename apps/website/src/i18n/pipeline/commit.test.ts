import { describe, expect, it } from 'vitest'

import { commitAll } from './commit'

/** An in-memory disk, so the failure paths can be driven deliberately. */
const disk = (initial: Record<string, string>, failOn?: string) => {
  const files = { ...initial }
  const writes: string[] = []
  const write = (file: string, contents: string) => {
    writes.push(file)
    if (file === failOn && contents !== initial[file]) {
      throw new Error(`disk full writing ${file}`)
    }
    files[file] = contents
  }
  const remove = (file: string) => {
    delete files[file]
  }
  return { files, writes, write, remove }
}

const plan = (files: string[]) =>
  files.map((file) => ({
    file,
    original: `old ${file}`,
    written: `new ${file}`
  }))

describe('commitAll', () => {
  it('writes every file when nothing fails', () => {
    const io = disk({ a: 'old a', b: 'old b' })

    commitAll(plan(['a', 'b']), io)

    expect(io.files).toEqual({ a: 'new a', b: 'new b' })
  })

  /**
   * The reason this exists. The writers claim all-or-nothing, but that only
   * held up to the point writing began: a failure on the tenth of eighteen
   * files left nine changed on disk and the run reporting an error, which is
   * the state a person is least able to reason about — half a translation run,
   * with no record of which half.
   */
  it('restores the files it already wrote when one fails', () => {
    const io = disk({ a: 'old a', b: 'old b', c: 'old c' }, 'c')

    expect(() => commitAll(plan(['a', 'b', 'c']), io)).toThrow(/disk full/)

    expect(io.files).toEqual({ a: 'old a', b: 'old b', c: 'old c' })
  })

  /**
   * The story writer creates files that did not exist. Putting one "back" by
   * writing its original would leave an empty `.mdx` where there had been no
   * file — a published story with no content, which the site would render.
   */
  it('removes a file it created, rather than emptying it', () => {
    const files: Record<string, string> = { a: 'old a' }
    const removed: string[] = []
    const write = (file: string, contents: string) => {
      if (file === 'new') throw new Error('disk full writing new')
      files[file] = contents
    }
    const remove = (file: string) => {
      removed.push(file)
      delete files[file]
    }

    expect(() =>
      commitAll(
        [
          { file: 'a', original: 'old a', written: 'new a' },
          { file: 'fresh', written: 'brand new' },
          { file: 'new', written: 'boom' }
        ],
        { write, remove }
      )
    ).toThrow(/disk full/)

    expect(removed).toEqual(['fresh'])
    expect(files).toEqual({ a: 'old a' })
  })

  /**
   * A failed rollback is worse than a failed write, because now nobody knows
   * what is on disk. It has to name both the original failure and the file it
   * could not put back, rather than surfacing whichever threw last.
   */
  it('reports the original failure and the file it could not restore', () => {
    const files: Record<string, string> = { a: 'old a', b: 'old b' }
    const write = (file: string, contents: string) => {
      if (file === 'b') throw new Error('disk full writing b')
      if (file === 'a' && contents === 'old a') {
        throw new Error('read-only restoring a')
      }
      files[file] = contents
    }

    const remove = () => {
      throw new Error('remove should not be reached for an existing file')
    }

    expect(() => commitAll(plan(['a', 'b']), { write, remove })).toThrow(
      /disk full writing b[\s\S]*could not restore[\s\S]*a/
    )
  })
})
