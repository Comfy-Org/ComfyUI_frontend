import { isPlainObject } from 'es-toolkit'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { api } from '@/scripts/api'
import { reportError } from '@comfyorg/telemetry/reportError'

const BOOKMARK_INDEX_FILE = 'workflows/.index.json'

type BookmarkIndexRead =
  | { ok: true; index: Record<string, unknown>; favorites: string[] }
  | { ok: false }

function emptyBookmarkIndex(): BookmarkIndexRead {
  return { ok: true, index: {}, favorites: [] }
}

function bookmarkReadFailed(cause: unknown): BookmarkIndexRead {
  reportError(cause, {
    errorType: 'failure_loading_workflow_bookmarks',
    surface: 'platform'
  })
  return { ok: false }
}

async function readBookmarkIndex(): Promise<BookmarkIndexRead> {
  let index: unknown
  try {
    const resp = await api.getUserData(BOOKMARK_INDEX_FILE)
    if (resp.status === 404) return emptyBookmarkIndex()
    if (resp.status !== 200) {
      return bookmarkReadFailed(
        new Error(`Bookmark index read failed: ${resp.status}`)
      )
    }
    index = await resp.json()
  } catch (cause) {
    return bookmarkReadFailed(cause)
  }
  if (!isPlainObject(index)) return emptyBookmarkIndex()
  const { favorites } = index
  return {
    ok: true,
    index,
    favorites: Array.isArray(favorites)
      ? favorites.filter((path): path is string => typeof path === 'string')
      : []
  }
}

async function writeBookmarkIndex(
  index: Record<string, unknown>,
  favorites: string[]
): Promise<boolean> {
  try {
    const resp = await api.storeUserData(
      BOOKMARK_INDEX_FILE,
      { ...index, favorites },
      { overwrite: true, stringify: true, throwOnError: false }
    )
    return resp.status === 200
  } catch (cause) {
    reportError(cause, {
      errorType: 'failure_saving_workflow_bookmarks',
      surface: 'platform'
    })
    return false
  }
}

export const useWorkflowBookmarkStore = defineStore('workflowBookmark', () => {
  const confirmedBookmarks = ref<ReadonlySet<string>>(new Set())
  const pending = ref(new Map<string, { value: boolean; change: number }>())
  let changeCount = 0
  let queue: Promise<unknown> = Promise.resolve()

  const isBookmarked = (path: string) =>
    pending.value.get(path)?.value ?? confirmedBookmarks.value.has(path)

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task)
    queue = run.catch(() => undefined)
    return run
  }

  function loadBookmarks(): Promise<void> {
    return enqueue(async () => {
      const read = await readBookmarkIndex()
      if (read.ok) confirmedBookmarks.value = new Set(read.favorites)
    })
  }

  async function saveBookmarkChange(
    optimisticValues: ReadonlyMap<string, boolean>,
    edit: (favorites: Set<string>) => void
  ): Promise<boolean> {
    const id = ++changeCount
    for (const [path, value] of optimisticValues) {
      pending.value.set(path, { value, change: id })
    }
    const saved = await enqueue(async () => {
      const read = await readBookmarkIndex()
      if (!read.ok) return false
      const next = new Set(read.favorites)
      edit(next)
      const unchanged =
        next.size === read.favorites.length &&
        read.favorites.every((path) => next.has(path))
      const ok =
        unchanged || (await writeBookmarkIndex(read.index, Array.from(next)))
      confirmedBookmarks.value = ok ? next : new Set(read.favorites)
      return ok
    })
    for (const path of optimisticValues.keys()) {
      if (pending.value.get(path)?.change === id) pending.value.delete(path)
    }
    return saved
  }

  const setBookmarked = (path: string, value: boolean) =>
    saveBookmarkChange(new Map([[path, value]]), (favorites) => {
      if (value) favorites.add(path)
      else favorites.delete(path)
    })

  const moveBookmark = (oldPath: string, newPath: string) =>
    saveBookmarkChange(
      isBookmarked(oldPath)
        ? new Map([
            [oldPath, false],
            [newPath, true]
          ])
        : new Map(),
      (favorites) => {
        if (favorites.delete(oldPath)) favorites.add(newPath)
      }
    )

  const toggleBookmarked = async (path: string) => {
    const saved = await setBookmarked(path, !isBookmarked(path))
    if (!saved) {
      useToast().error(t('g.error'), {
        description: t('sideToolbar.workflowTab.bookmarkSaveFailed')
      })
    }
    return saved
  }

  return {
    isBookmarked,
    loadBookmarks,
    moveBookmark,
    setBookmarked,
    toggleBookmarked
  }
})
