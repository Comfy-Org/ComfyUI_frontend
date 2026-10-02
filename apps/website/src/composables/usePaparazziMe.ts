import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import { imageSize } from '../lib/workshop/image-size'
import type {
  PaparazziResult,
  PaparazziSearch,
  SceneCandidate
} from '../lib/workshop/paparazzi-me/contract'
import { paparazziRequest } from '../lib/workshop/paparazzi-me/contract'
import {
  PAPARAZZI_EXAMPLE,
  runPaparazzi
} from '../lib/workshop/paparazzi-me/mock-run'
import { lookUp, searchScenes } from '../lib/workshop/paparazzi-me/mock-search'
import type { PaparazziSetup } from '../lib/workshop/paparazzi-me/setup'
import {
  DEFAULT_SETUP,
  hasCelebrity,
  nextSeed
} from '../lib/workshop/paparazzi-me/setup'
import { useCinematicPopover } from './useCinematicPopover'

export interface PaparazziImage {
  readonly url: string
  readonly name: string
  readonly width: number
  readonly height: number
}

type PaparazziPhase =
  | { readonly kind: 'editing' }
  | { readonly kind: 'running'; readonly startedAt: number }
  | { readonly kind: 'done'; readonly result: PaparazziResult }
  | { readonly kind: 'failed' }

type SceneSearch =
  | { readonly kind: 'idle' }
  | { readonly kind: 'searching'; readonly query: string }
  | ({ readonly kind: 'found'; readonly query: string } & PaparazziSearch)
  | { readonly kind: 'failed'; readonly query: string }

export type PaparazziTray = 'face' | 'star' | 'scene' | 'seed'

function queryOf(celebrity: string): string {
  return celebrity.trim().toLowerCase()
}

/**
 * Paparazzi me's page state, opened on the worked example so it demos at
 * once: the example face, the example star looked up, her red-carpet photo
 * picked. The look-up and the run are mocked for now.
 */
export function usePaparazziMe() {
  const found = new Map<string, PaparazziSearch>([
    [queryOf(DEFAULT_SETUP.celebrity), lookUp(DEFAULT_SETUP.celebrity)]
  ])
  const face = shallowRef<PaparazziImage>(PAPARAZZI_EXAMPLE)
  const ownScene = shallowRef<PaparazziImage>()
  const setup = shallowRef<PaparazziSetup>(DEFAULT_SETUP)
  const past = shallowRef<PaparazziSetup[]>([])
  const future = shallowRef<PaparazziSetup[]>([])
  const phase = shallowRef<PaparazziPhase>({ kind: 'editing' })
  const search = shallowRef<SceneSearch>({
    kind: 'found',
    query: queryOf(DEFAULT_SETUP.celebrity),
    ...lookUp(DEFAULT_SETUP.celebrity)
  })
  const tray = ref<PaparazziTray>()
  const picker = useCinematicPopover<'scene'>()
  const compare = ref(false)
  const touched = ref(false)
  const ownUrls = new Set<string>()
  let lastEdit: string | undefined
  let picks = 0
  let run: AbortController | undefined
  let looking: AbortController | undefined
  let pending = Promise.resolve()

  const candidates = computed<readonly SceneCandidate[]>(() =>
    search.value.kind === 'found' ? search.value.candidates : []
  )
  const candidate = computed(
    () =>
      candidates.value.find(({ token }) => token === setup.value.sceneToken) ??
      candidates.value.at(0)
  )
  const usingOwnScene = computed(
    () => setup.value.ownScene && Boolean(ownScene.value)
  )
  /** The scene photo the stage shows and the run puts the visitor in. */
  const scene = computed(() => {
    if (usingOwnScene.value && ownScene.value)
      return { kind: 'own', image: ownScene.value } as const
    return candidate.value
      ? ({ kind: 'found', candidate: candidate.value } as const)
      : undefined
  })
  const missingStar = computed(
    () => !usingOwnScene.value && !hasCelebrity(setup.value.celebrity)
  )
  const canRun = computed(
    () => phase.value.kind !== 'running' && !missingStar.value
  )

  function leaveResult(next: PaparazziPhase) {
    const current = phase.value
    if (current.kind === 'done' && current.result.url.startsWith('blob:'))
      URL.revokeObjectURL(current.result.url)
    phase.value = next
  }

  function stopRun() {
    run?.abort()
    run = undefined
    leaveResult({ kind: 'editing' })
  }

  /** Shows the look-up already made for the setup's star, if any. */
  function syncSearch() {
    const query = queryOf(setup.value.celebrity)
    const current = search.value
    if (current.kind !== 'idle' && current.query === query) return
    looking?.abort()
    const known = found.get(query)
    search.value = known ? { kind: 'found', query, ...known } : { kind: 'idle' }
  }

  function apply(next: PaparazziSetup) {
    setup.value = next
    syncSearch()
  }

  /** Changes the setup; edits that share a `key` in a row undo as one. */
  function change(patch: Partial<PaparazziSetup>, key?: string) {
    touched.value = true
    if (!key || key !== lastEdit) {
      past.value = [...past.value, setup.value]
      future.value = []
    }
    lastEdit = key
    apply({ ...setup.value, ...patch })
  }

  async function lookUpStar(celebrity: string, query: string) {
    const controller = new AbortController()
    looking = controller
    search.value = { kind: 'searching', query }
    try {
      const answer = await searchScenes(celebrity, controller.signal)
      found.set(query, answer)
      if (looking === controller)
        search.value = { kind: 'found', query, ...answer }
    } catch {
      if (looking === controller && !controller.signal.aborted)
        search.value = { kind: 'failed', query }
    }
  }

  /** Looks the setup's star up, unless that look-up is done or under way. */
  function findScenes(): Promise<void> {
    const celebrity = setup.value.celebrity
    const query = queryOf(celebrity)
    const current = search.value
    const settled =
      (current.kind === 'searching' || current.kind === 'found') &&
      current.query === query
    if (!hasCelebrity(celebrity)) return Promise.resolve()
    if (settled) return pending
    looking?.abort()
    pending = lookUpStar(celebrity, query)
    return pending
  }

  function pickScene(token: string) {
    change({ sceneToken: token, ownScene: false })
  }

  function pickOwnScene() {
    if (ownScene.value) change({ ownScene: true })
  }

  function release(image: PaparazziImage | undefined) {
    if (image && ownUrls.delete(image.url)) URL.revokeObjectURL(image.url)
  }

  async function readImage(file: File): Promise<PaparazziImage | undefined> {
    picks += 1
    const pick = picks
    const url = URL.createObjectURL(file)
    const size = await imageSize(url)
    if (pick === picks && size) {
      ownUrls.add(url)
      return { url, name: file.name, ...size }
    }
    URL.revokeObjectURL(url)
    return undefined
  }

  async function useFaceFile(file: File) {
    const image = await readImage(file)
    if (!image) return
    stopRun()
    release(face.value)
    face.value = image
    touched.value = true
  }

  async function useSceneFile(file: File) {
    const image = await readImage(file)
    if (!image) return
    stopRun()
    release(ownScene.value)
    ownScene.value = image
    change({ ownScene: true })
  }

  function undo() {
    const previous = past.value.at(-1)
    if (!previous) return
    future.value = [setup.value, ...future.value]
    past.value = past.value.slice(0, -1)
    apply(previous)
    lastEdit = undefined
  }

  function redo() {
    const next = future.value.at(0)
    if (!next) return
    past.value = [...past.value, setup.value]
    future.value = future.value.slice(1)
    apply(next)
    lastEdit = undefined
  }

  /** The scene for the request, looking the star up first when needed. */
  async function sceneForRun() {
    if (usingOwnScene.value && ownScene.value)
      return { upload: ownScene.value.url }
    await findScenes()
    return candidate.value && { token: candidate.value.token }
  }

  async function snap() {
    if (!canRun.value) return
    tray.value = undefined
    picker.close()
    const controller = new AbortController()
    run = controller
    leaveResult({ kind: 'running', startedAt: Date.now() })
    try {
      const target = await sceneForRun()
      if (run !== controller) return
      const result = await runPaparazzi(
        paparazziRequest(face.value.url, setup.value, target),
        controller.signal
      )
      if (run === controller) {
        compare.value = false
        phase.value = { kind: 'done', result }
      } else if (result.url.startsWith('blob:')) URL.revokeObjectURL(result.url)
    } catch {
      if (run === controller && !controller.signal.aborted)
        phase.value = { kind: 'failed' }
    }
  }

  /** Another take: the next seed, run straight away. */
  function retry() {
    change({ seed: nextSeed(setup.value.seed) })
    void snap()
  }

  function cancel() {
    stopRun()
  }

  function edit() {
    leaveResult({ kind: 'editing' })
  }

  function toggleTray(next: PaparazziTray) {
    tray.value = tray.value === next ? undefined : next
  }

  function openPicker() {
    void findScenes()
    picker.toggle('scene')
  }

  tryOnScopeDispose(() => {
    run?.abort()
    looking?.abort()
    picks += 1
    leaveResult({ kind: 'editing' })
    ownUrls.forEach((url) => URL.revokeObjectURL(url))
  })

  return {
    face,
    ownScene,
    setup,
    phase,
    search,
    candidates,
    scene,
    tray,
    pickerOpen: computed(() => picker.open.value === 'scene'),
    compare,
    touched,
    canRun,
    missingStar,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    change,
    findScenes,
    pickScene,
    pickOwnScene,
    useFaceFile,
    useSceneFile,
    undo,
    redo,
    snap,
    retry,
    cancel,
    edit,
    toggleTray,
    openPicker,
    closePicker: picker.close
  }
}

export type PaparazziMe = ReturnType<typeof usePaparazziMe>
