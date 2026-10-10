/**
 * Darkroom's state for one signed-in account: the feed, moodboards, the
 * requests in flight and what the account may do. Images are made by Comfy
 * Router as the signed-in user and kept in the browser's storage; nothing
 * here needs a server of Darkroom's own.
 */
import { useMounted } from '@vueuse/core'
import {
  computed,
  onScopeDispose,
  ref,
  shallowReactive,
  shallowRef,
  watch
} from 'vue'

import {
  darkroomSavesToCloud,
  saveDarkroomAsset
} from '@/config/darkroom-cloud-assets'
import type { DarkroomProgress } from '@/config/darkroom-router'
import {
  cancelDarkroomImage,
  collectDarkroomImage,
  DarkroomRouterError,
  readDarkroomConcurrency,
  submitDarkroomImage
} from '@/config/darkroom-router'
import { requestWorkshopBuyCreditsAutomatically } from '@/config/workshop-buy-credits'
import { refreshWorkshopCredits } from '@/config/workshop-credits'
import { useWorkshopModelBalance } from '@/config/workshop-model-balance'
import type { WorkshopSession } from '@/config/workshop-session-state'
import { useWorkshopSession } from '@/config/workshop-session-state'
import { workshopIdempotencyKey } from '@/config/workshop-snippets'
import type { DarkroomFailure } from '@/lib/darkroom/failure'
import {
  failureDetail,
  failureFromResponse,
  needsCredits
} from '@/lib/darkroom/failure'
import type {
  DarkroomJob,
  DarkroomReference,
  DarkroomSlot,
  PendingSlot
} from '@/lib/darkroom/feed'
import {
  doneSlots,
  isDone,
  isPending,
  jobsFromStore,
  pendingCount,
  pendingSlot,
  withoutItems,
  withSlot
} from '@/lib/darkroom/feed'
import { drawSheet, fileToInput, planSheets } from '@/lib/darkroom/moodboard'
import type {
  DarkroomDraft,
  DarkroomImageInput,
  DarkroomMoodboardRef,
  DarkroomRequest
} from '@/lib/darkroom/request'
import { baseSeed, buildDarkroomBody } from '@/lib/darkroom/request'
import type { DarkroomImagePart } from '@/lib/darkroom/response'
import { base64Bytes } from '@/lib/darkroom/response'
import type {
  DarkroomBoard,
  DarkroomItem,
  DarkroomStore
} from '@/lib/darkroom/store'
import { darkroomId, isUploadId, openDarkroomStore } from '@/lib/darkroom/store'
import { runsAllowed } from '@/lib/darkroom/vocabulary'
import { studioGate } from '@/lib/workshop/cinematic-studio/gate'
import { useWorkshopAuthFlag, useWorkshopEnabled } from '@/scripts/posthog'

/** Something to tell the reader. The page translates `key` and shows it. */
export interface DarkroomNotice {
  readonly key: string
  readonly values?: Readonly<Record<string, string | number>>
  readonly undo?: () => void
}

interface SlotWork {
  readonly request: DarkroomRequest
  readonly images: readonly DarkroomImageInput[]
  controller: AbortController
}

const BOARD_NAME_LIMIT = 80

export function useDarkroom(notify: (notice: DarkroomNotice) => void) {
  const { user, session, sessionFailure, settled, ensureFresh } =
    useWorkshopSession()
  const balance = useWorkshopModelBalance(session)
  const workshopEnabled = useWorkshopEnabled()
  const authEnabled = useWorkshopAuthFlag()
  const mounted = useMounted()

  const jobs = shallowRef<DarkroomJob[]>([])
  const boards = shallowRef<DarkroomBoard[]>([])
  /** Addresses for stored images, made as the feed loads them. */
  const urls = shallowReactive(new Map<string, string>())
  const loaded = ref(false)
  const storageFailed = ref(false)
  const concurrency = ref<number>()

  let store: DarkroomStore | undefined
  let owner: WorkshopSession | undefined
  /** What a developing or failed slot needs to stop or try again. */
  const work = new Map<string, SlotWork>()
  const lifetime = new AbortController()

  const credits = computed(() =>
    balance.value.status === 'ok' ? balance.value.credits : undefined
  )
  const developing = computed(() => pendingCount(jobs.value))
  const gate = computed(() =>
    studioGate({
      runEnabled:
        workshopEnabled.value &&
        import.meta.env.PUBLIC_WORKSHOP_ROUTER_RUN === '1',
      modelRunnable: true,
      mounted: mounted.value,
      authAvailable: authEnabled.value && !sessionFailure.value,
      sessionSettled: settled.value && !(user.value && !session.value),
      role: session.value?.role,
      // A balance read mid-run lags the charges still landing.
      credits: developing.value ? undefined : credits.value
    })
  )
  /** How many images one prompt may make for this account. */
  const maxRuns = computed(() => runsAllowed(concurrency.value))
  const blocked = computed(() => concurrency.value === 0)

  async function tokenFor(startedFor: WorkshopSession): Promise<string> {
    const credential = await ensureFresh(undefined, {
      signal: lifetime.signal
    })
    if (
      credential?.status !== 'ok' ||
      credential.session.uid !== startedFor.uid ||
      credential.session.workspace.id !== startedFor.workspace.id
    )
      throw new DarkroomRouterError('signedOut')
    return credential.session.token
  }

  function setSlot(key: string, change: (slot: DarkroomSlot) => DarkroomSlot) {
    jobs.value = withSlot(jobs.value, key, change)
  }

  function trackUrl(id: string, blob: Blob): string {
    const existing = urls.get(id)
    if (existing) return existing
    const url = URL.createObjectURL(blob)
    urls.set(id, url)
    return url
  }

  function releaseUrls() {
    for (const url of urls.values()) URL.revokeObjectURL(url)
    urls.clear()
  }

  async function loadUrls(ids: readonly string[], from: DarkroomStore) {
    await Promise.all(
      ids.map(async (id) => {
        if (urls.has(id)) return
        const blob = await from.blob(id).catch(() => undefined)
        if (blob && store === from) trackUrl(id, blob)
      })
    )
  }

  // ---------- account lifecycle ----------

  function leaveAccount() {
    for (const entry of work.values()) entry.controller.abort()
    work.clear()
    store?.close()
    store = undefined
    owner = undefined
    jobs.value = []
    boards.value = []
    concurrency.value = undefined
    loaded.value = false
    releaseUrls()
  }

  async function enterAccount(next: WorkshopSession) {
    leaveAccount()
    owner = next
    storageFailed.value = false
    let opened: DarkroomStore
    try {
      opened = await openDarkroomStore(next.uid, next.workspace.id)
    } catch {
      if (owner === next) storageFailed.value = loaded.value = true
      return
    }
    if (owner !== next) return opened.close()
    store = opened
    const [items, pending, savedBoards] = await Promise.all([
      opened.items(),
      opened.pending(),
      opened.boards()
    ])
    if (store !== opened) return
    jobs.value = jobsFromStore(items, pending)
    boards.value = savedBoards
    loaded.value = true
    void loadUrls(
      [
        ...items.map((item) => item.id),
        ...savedBoards.flatMap((board) => board.items.filter(isUploadId))
      ],
      opened
    )
    for (const request of pending) {
      const key = `${request.settings.jobId}:${request.settings.run}`
      const entry: SlotWork = {
        request: request.settings,
        // References are not kept, so a recovered image cannot be retried
        // with them; without any, it can.
        images: [],
        controller: new AbortController()
      }
      work.set(key, entry)
      void develop(key, entry, next, request.requestId, request.imageCount > 0)
    }
    void readDarkroomConcurrency(() => tokenFor(next), lifetime.signal).then(
      (limit) => {
        if (owner === next) concurrency.value = limit
      },
      () => {}
    )
  }

  watch(
    () =>
      session.value
        ? `${session.value.uid}:${session.value.workspace.id}`
        : undefined,
    () => {
      if (session.value) void enterAccount(session.value)
      else leaveAccount()
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    lifetime.abort()
    leaveAccount()
  })

  // ---------- generate ----------

  async function imageBlob(part: DarkroomImagePart, signal: AbortSignal) {
    if ('data' in part)
      return new Blob([base64Bytes(part.data)], { type: part.mime })
    const response = await fetch(part.uri, {
      credentials: 'omit',
      signal
    })
    if (!response.ok)
      throw new DarkroomRouterError('generic', `Image HTTP ${response.status}`)
    return response.blob()
  }

  function fail(
    key: string,
    failure: DarkroomFailure,
    detail = '',
    cancelled = false
  ) {
    setSlot(key, (slot) => ({
      key: slot.key,
      run: slot.run,
      seed: slot.seed,
      status: 'error',
      failure,
      detail,
      ...(cancelled ? { cancelled } : {})
    }))
    if (!needsCredits(failure)) return
    // The same recovery the model pages offer: the shared top-up dialog,
    // which decides for itself what this account may buy, and a fresh balance.
    requestWorkshopBuyCreditsAutomatically()
    void refreshWorkshopCredits({ force: true })
  }

  function showProgress(key: string, progress: DarkroomProgress) {
    setSlot(key, (slot) => {
      if (!isPending(slot)) return slot
      if (progress.phase === 'queued')
        return { ...slot, phase: 'queued', ahead: progress.ahead }
      return slot.phase === 'running'
        ? slot
        : { ...slot, phase: 'running', ahead: undefined, startedAt: Date.now() }
    })
  }

  /**
   * Sees one image through: hand it to Router (unless a reload is picking up
   * a request Router already holds), wait for it, then keep it.
   */
  async function develop(
    key: string,
    entry: SlotWork,
    startedFor: WorkshopSession,
    resumeId?: string,
    hadReferences = entry.images.length > 0
  ) {
    const active = store
    const { request } = entry
    const { signal } = entry.controller
    const token = () => tokenFor(startedFor)
    const startedAt = Date.now()
    let requestId = resumeId
    try {
      if (!requestId) {
        const submission = await submitDarkroomImage({
          model: request.model,
          body: buildDarkroomBody(request, entry.images),
          idempotencyKey: workshopIdempotencyKey(),
          token,
          // The send is seen through even if the reader cancels meanwhile:
          // aborting it could leave Router running a request whose id never
          // came back, with no way left to stop it.
          signal: lifetime.signal
        })
        requestId = submission.requestId
        if (signal.aborted) {
          void cancelDarkroomImage({
            model: request.model,
            requestId,
            token
          }).catch(() => {})
          return
        }
        await active?.savePending({
          requestId,
          settings: request,
          created: startedAt,
          imageCount: entry.images.length
        })
        showProgress(key, submission.progress)
      }
      const collecting = requestId
      setSlot(key, (slot) =>
        isPending(slot) ? { ...slot, requestId: collecting } : slot
      )
      const result = await collectDarkroomImage({
        model: request.model,
        requestId,
        token,
        signal,
        onProgress: (progress) => showProgress(key, progress)
      })
      const failure = failureFromResponse(result.response)
      if (failure) {
        await active?.removePending(requestId)
        return fail(key, failure, failureDetail(result.response))
      }
      setSlot(key, (slot) =>
        isPending(slot) ? { ...slot, phase: 'saving' } : slot
      )
      const part = result.response.images[result.response.images.length - 1]
      const blob = await imageBlob(part, signal)
      const running = jobs.value
        .flatMap((job) => job.slots)
        .find((slot) => slot.key === key)
      const item: DarkroomItem = {
        id: darkroomId(),
        created: Date.now(),
        mime: blob.type || part.mime,
        settings: request,
        stats: {
          seconds:
            Math.round(
              (Date.now() -
                (running && isPending(running)
                  ? running.startedAt
                  : startedAt)) /
                100
            ) / 10,
          modelVersion: result.response.modelVersion,
          totalTokens: result.response.totalTokens,
          finishReasons: result.response.finishReasons,
          fallbackProvider: result.fallbackProvider,
          droppedParams: result.droppedParams
        },
        text: result.response.texts
      }
      await active?.saveItem(item, blob)
      await active?.removePending(requestId)
      if (store !== active) return
      trackUrl(item.id, blob)
      work.delete(key)
      setSlot(key, (slot) => ({
        key: slot.key,
        run: slot.run,
        seed: slot.seed,
        status: 'done',
        item,
        fresh: true
      }))
      void refreshWorkshopCredits({ force: true })
      void keepInCloud(item, blob, startedFor)
    } catch (error) {
      if (signal.aborted) return
      if (requestId) await active?.removePending(requestId).catch(() => {})
      if (error instanceof DarkroomRouterError)
        return fail(key, error.failure, error.detail)
      fail(key, 'generic', String(error))
    } finally {
      // A recovered image's references are gone, so it cannot be tried again.
      if (hadReferences && resumeId) work.delete(key)
    }
  }

  async function keepInCloud(
    item: DarkroomItem,
    blob: Blob,
    startedFor: WorkshopSession
  ) {
    if (!darkroomSavesToCloud()) return
    const active = store
    try {
      const cloudAssetId = await saveDarkroomAsset(
        item,
        blob,
        await tokenFor(startedFor),
        lifetime.signal
      )
      await active?.patchItem(item.id, { cloudAssetId })
      if (store !== active) return
      patchItems(new Set([item.id]), (kept) => ({ ...kept, cloudAssetId }))
    } catch {
      // The image is already kept in the browser; the Cloud copy is extra.
    }
  }

  function boardById(id: string | undefined | null) {
    return boards.value.find((board) => board.id === id)
  }

  const sheetCache = new Map<string, Promise<DarkroomImageInput[]>>()
  function moodboardSheets(board: DarkroomBoard) {
    const cacheKey = `${board.id}|${board.items.join(',')}`
    const cached = sheetCache.get(cacheKey)
    if (cached) return cached
    const drawing = Promise.all(
      planSheets(
        board.items.flatMap((id) => {
          const url = urls.get(id)
          return url ? [url] : []
        })
      ).map(drawSheet)
    ).then((sheets) => sheets.filter((sheet) => sheet !== undefined))
    sheetCache.set(cacheKey, drawing)
    return drawing
  }

  /**
   * Starts a row: one request per image, each with the next seed. Returns
   * false when nothing was started.
   */
  async function generate(
    draft: DarkroomDraft,
    references: readonly DarkroomReference[],
    runs: number,
    typedSeed: string,
    boardId?: string | null
  ): Promise<boolean> {
    const startedFor = session.value
    if (!startedFor || gate.value !== 'ready' || blocked.value) return false
    const count = Math.max(1, Math.min(runs, maxRuns.value))
    const seed = baseSeed(typedSeed)
    const jobId = darkroomId()
    const candidate = boardById(boardId)
    const board = candidate?.items.length ? candidate : undefined
    const own = references.map(({ mime, data }) => ({ mime, data }))
    const boardRef: DarkroomMoodboardRef | undefined = board && {
      id: board.id,
      name: board.name,
      count: board.items.length
    }
    let moodboard = boardRef
    const settingsFor = (run: number): DarkroomRequest => ({
      ...draft,
      seed: seed + run,
      jobId,
      run,
      runs: count,
      inputCount: own.length,
      ...(moodboard ? { moodboard } : {})
    })
    const rowOf = (): DarkroomJob => ({
      jobId,
      settings: settingsFor(0),
      created: Date.now(),
      slots: Array.from({ length: count }, (_, run) =>
        pendingSlot(jobId, run, seed + run)
      ),
      ...(references.length ? { references } : {})
    })
    jobs.value = [rowOf(), ...jobs.value]

    let sheets: DarkroomImageInput[] = []
    if (board) {
      sheets = await moodboardSheets(board).catch(() => [])
      if (boardRef && sheets.length)
        moodboard = { ...boardRef, sheets: sheets.length }
      else {
        moodboard = undefined
        notify({ key: 'moodboardUnreadable', values: { name: board.name } })
      }
      jobs.value = jobs.value.map((job) =>
        job.jobId === jobId ? { ...job, settings: settingsFor(0) } : job
      )
    }
    if (
      owner?.uid !== startedFor.uid ||
      owner.workspace.id !== startedFor.workspace.id
    )
      return false
    const images = [...own, ...sheets]
    for (let run = 0; run < count; run++) {
      const key = `${jobId}:${run}`
      const entry: SlotWork = {
        request: settingsFor(run),
        images,
        controller: new AbortController()
      }
      work.set(key, entry)
      void develop(key, entry, startedFor)
    }
    return true
  }

  function retry(key: string) {
    const entry = work.get(key)
    const startedFor = session.value
    if (!entry || !startedFor) return
    entry.controller = new AbortController()
    setSlot(key, (slot) =>
      pendingSlot(entry.request.jobId, slot.run, slot.seed)
    )
    void develop(key, entry, startedFor)
  }

  const canRetry = (key: string) => work.has(key)

  /**
   * Stops one image. One still in line is dropped before the model runs and
   * costs nothing; one already developing is cancelled on Router's side too,
   * though the model may have finished it by then.
   */
  function cancel(slot: PendingSlot) {
    const entry = work.get(slot.key)
    const startedFor = owner
    entry?.controller.abort()
    if (entry && slot.requestId && startedFor) {
      const requestId = slot.requestId
      void cancelDarkroomImage({
        model: entry.request.model,
        requestId,
        token: () => tokenFor(startedFor)
      }).catch(() => {})
      void store?.removePending(requestId).catch(() => {})
    }
    fail(
      slot.key,
      slot.phase === 'running' || slot.phase === 'saving'
        ? 'stopped'
        : 'cancelledInLine',
      '',
      true
    )
  }

  function cancelJob(job: DarkroomJob) {
    for (const slot of job.slots) if (isPending(slot)) cancel(slot)
  }

  // ---------- stars, delete, undo ----------

  function patchItems(
    ids: ReadonlySet<string>,
    change: (item: DarkroomItem) => DarkroomItem
  ) {
    jobs.value = jobs.value.map((job) =>
      job.slots.some((slot) => isDone(slot) && ids.has(slot.item.id))
        ? {
            ...job,
            slots: job.slots.map((slot) =>
              isDone(slot) && ids.has(slot.item.id)
                ? { ...slot, item: change(slot.item) }
                : slot
            )
          }
        : job
    )
  }

  async function setStarred(ids: readonly string[], starred: boolean) {
    patchItems(new Set(ids), ({ starred: _was, ...item }) =>
      starred ? { ...item, starred } : item
    )
    try {
      await Promise.all(ids.map((id) => store?.patchItem(id, { starred })))
      if (ids.length > 1)
        notify({
          key: starred ? 'starredMany' : 'unstarredMany',
          values: { count: ids.length }
        })
    } catch {
      notify({ key: 'starFailed' })
    }
  }

  /**
   * Deletes images to the trash, so the notice can offer Undo instead of
   * asking first. Starred images are skipped until they are unstarred.
   */
  async function deleteItems(ids: readonly string[]) {
    const starred = new Set(
      doneSlots(jobs.value)
        .filter((slot) => slot.item.starred)
        .map((slot) => slot.item.id)
    )
    const gone = ids.filter((id) => !starred.has(id))
    const kept = ids.length - gone.length
    if (!gone.length)
      return notify({ key: kept === 1 ? 'starredKeptOne' : 'starredKeptMany' })
    const before = jobs.value
    await store?.trash(gone)
    jobs.value = withoutItems(jobs.value, new Set(gone))
    notify({
      key: kept ? 'deletedKept' : 'deleted',
      values: { count: gone.length, kept },
      undo: () => void undoDelete(gone, before)
    })
  }

  async function undoDelete(
    ids: readonly string[],
    before: readonly DarkroomJob[]
  ) {
    try {
      const restored = new Set(
        (await store?.restore(ids))?.map((item) => item.id)
      )
      // Rows made since the delete stay on top; the rest go back as they were.
      const known = new Set(before.map((job) => job.jobId))
      const fresh = jobs.value.filter((job) => !known.has(job.jobId))
      const current = new Map(jobs.value.map((job) => [job.jobId, job]))
      jobs.value = [
        ...fresh,
        ...before.flatMap((job) => {
          const live = current.get(job.jobId)
          const slots = job.slots.flatMap((slot) => {
            const now = live?.slots.find((other) => other.key === slot.key)
            if (now) return [now]
            return isDone(slot) && restored.has(slot.item.id) ? [slot] : []
          })
          return slots.length ? [{ ...job, slots }] : []
        })
      ]
      notify({ key: 'restored', values: { count: restored.size } })
    } catch {
      notify({ key: 'undoFailed' })
    }
  }

  async function deleteJob(job: DarkroomJob) {
    cancelJob(job)
    const ids = job.slots.filter(isDone).map((slot) => slot.item.id)
    if (ids.length) return deleteItems(ids)
    // Only failed or cancelled tiles: nothing to undo.
    for (const slot of job.slots) work.delete(slot.key)
    jobs.value = jobs.value.filter((other) => other.jobId !== job.jobId)
  }

  // ---------- moodboards ----------

  async function putBoard(board: DarkroomBoard) {
    await store?.saveBoard(board)
    boards.value = boards.value.some((other) => other.id === board.id)
      ? boards.value.map((other) => (other.id === board.id ? board : other))
      : [...boards.value, board]
    return board
  }

  function createBoard(name: string, items: readonly string[] = []) {
    const now = Date.now()
    return putBoard({
      id: darkroomId(now),
      name: name.trim().slice(0, BOARD_NAME_LIMIT) || 'Untitled moodboard',
      created: now,
      updated: now,
      items: [...new Set(items)]
    })
  }

  function updateBoard(
    id: string,
    change: {
      readonly name?: string
      readonly add?: readonly string[]
      readonly remove?: readonly string[]
    }
  ) {
    const board = boardById(id)
    if (!board) return undefined
    const drop = new Set(change.remove)
    const name = change.name?.trim().slice(0, BOARD_NAME_LIMIT)
    return putBoard({
      ...board,
      name: name || board.name,
      items: [...new Set([...board.items, ...(change.add ?? [])])].filter(
        (item) => !drop.has(item)
      ),
      updated: Date.now()
    })
  }

  async function deleteBoard(id: string) {
    const board = boardById(id)
    if (!board) return
    await store?.deleteBoard(id)
    boards.value = boards.value.filter((other) => other.id !== id)
    // Uploaded images no other board uses go with it.
    const used = new Set(boards.value.flatMap((other) => other.items))
    const orphans = board.items.filter(
      (item) => isUploadId(item) && !used.has(item)
    )
    await store?.deleteUploads(orphans)
    for (const orphan of orphans) {
      const url = urls.get(orphan)
      if (url) URL.revokeObjectURL(url)
      urls.delete(orphan)
    }
  }

  async function uploadToBoard(id: string, files: readonly File[]) {
    const images = files.filter((file) => file.type.startsWith('image/'))
    const active = store
    if (!images.length || !active) return
    try {
      const added = await Promise.all(
        images.map(async (file) => {
          const uploadId = await active.saveUpload(file)
          trackUrl(uploadId, file)
          return uploadId
        })
      )
      const board = await updateBoard(id, { add: added })
      if (board)
        notify({
          key: 'addedToBoard',
          values: { count: added.length, name: board.name }
        })
    } catch {
      notify({ key: 'boardFailed' })
    }
  }

  /** Adds images to a board, or starts a new board with them. */
  async function addToBoard(
    items: readonly string[],
    id: string | undefined,
    newName?: string
  ) {
    try {
      const board = id
        ? await updateBoard(id, { add: items })
        : await createBoard(newName ?? '', items)
      if (board)
        notify({
          key: 'addedToBoard',
          values: { count: items.length, name: board.name }
        })
    } catch {
      notify({ key: 'boardFailed' })
    }
  }

  /** Board images that still exist: a deleted image drops out of its boards. */
  function boardItems(board: DarkroomBoard): string[] {
    const live = new Set(doneSlots(jobs.value).map((slot) => slot.item.id))
    return board.items.filter((item) => isUploadId(item) || live.has(item))
  }

  /** A stored image as a reference for the prompt bar. */
  async function referenceFrom(
    item: DarkroomItem
  ): Promise<DarkroomReference | undefined> {
    const blob = await store?.blob(item.id)
    if (!blob) return undefined
    return { ...(await fileToInput(blob)), name: item.id }
  }

  return {
    jobs,
    boards,
    urls,
    loaded,
    storageFailed,
    gate,
    credits,
    maxRuns,
    blocked,
    developing,
    savesToCloud: darkroomSavesToCloud(),
    generate,
    retry,
    canRetry,
    cancel,
    cancelJob,
    setStarred,
    deleteItems,
    deleteJob,
    boardById,
    boardItems,
    createBoard,
    updateBoard,
    deleteBoard,
    uploadToBoard,
    addToBoard,
    referenceFrom
  }
}
