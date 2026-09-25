import type { CreationSettings,SavedCreation } from '../lib/workshop/cinematic-studio/creations'
import {
  validShotSeed,
  allowedShotAspect,
  fetchShotImage
} from './cinematicShotHelpers'
import { nextSeed } from '../lib/workshop/cinematic-studio/seed-behavior'
import type { SeedBehavior } from '../lib/workshop/cinematic-studio/seed-behavior'
import type { MotionComparisonPayload } from '../lib/workshop/cinematic-studio/motion-comparison'
import { generationTimingNamespaceKey } from '../lib/workshop/cinematic-studio/generation-timings'
import { useCinematicComposerDrafts } from './useCinematicComposerDrafts'
import type {
  ComposerDrafts,
  ComposerModeDraft
} from '../lib/workshop/cinematic-studio/composer-drafts'
import type { CinematicTransitionApply } from '../lib/workshop/cinematic-studio/transition'
import {
  saveReferenceBundle,
  loadReferenceBundle
} from '../lib/workshop/cinematic-studio/reference-bundles'
import type { ReferenceFile } from '../lib/workshop/cinematic-studio/reference-bundles'
import type { CinematicRecipeImport } from '../lib/workshop/cinematic-studio/recipes'
import type {
  PlanSettingsSnapshot,
  PlanShotMetadata
} from '../lib/workshop/cinematic-studio/scene-builder'
import { listAssets, assetFile } from '../lib/workshop/cinematic-studio/assets'
import type { AssetReference } from '../lib/workshop/cinematic-studio/assets'
import { assetReferencePrompt } from '../lib/workshop/cinematic-studio/asset-reference-prompt'
import {
  defaultCreativeSettings,
  creativePrompt,
  validateCreativeSettings
} from '../lib/workshop/cinematic-studio/creative'
import { creationNamespace } from '../lib/workshop/cinematic-studio/creations'
import { useCinematicLibrary } from './useCinematicLibrary'
import {
  computed,
  onMounted,
  onScopeDispose,
  provide,
  ref,
  shallowRef,
  watch
} from 'vue'

import type {
  AspectRatio,
  Direction,
  DirectionPart,
  Resolution
} from '../lib/workshop/cinematic-studio/catalog'
import {
  DEFAULT_DIRECTION,
  AUTO_DIRECTION,
  RESOLUTIONS,
  directionOption
} from '../lib/workshop/cinematic-studio/catalog'
import type { CinematicModel } from '../lib/workshop/cinematic-studio/models'
import {
  cinematicPrompt,
  cinematicPromptSegments
} from '../lib/workshop/cinematic-studio/prompt'
import type { StarterShot } from '../lib/workshop/cinematic-studio/starters'
import { isCinematicDemo, useCinematicDemoRun } from './useCinematicDemoRun'
import { useCinematicStudioRun } from './useCinematicStudioRun'
import type { ShotRequest } from './useCinematicStudioRun'

export interface CinematicReview {
  readonly seedUpdate?: {
    modelSlug: string
    mode: 'image' | 'video'
    behavior: SeedBehavior
    bounds: NonNullable<CinematicModel['seed']>
  }
  readonly batch?: readonly ShotRequest[]
  readonly request: ShotRequest
  readonly modelName: string
  readonly resolution: string
  readonly adaptiveAspect?: boolean
  readonly workspaceId?: string
  readonly userId?: string
}

type ReusableShot = Pick<
  SavedCreation,
  'kind' | 'modelSlug' | 'prompt' | 'aspect' | 'settings'
>

/** The shot being directed, shared by every Cinematic Studio layout. */
export function useCinematicShot(
  models: readonly CinematicModel[],
  editingModels: readonly CinematicModel[] = []
) {
  const studio = isCinematicDemo()
    ? useCinematicDemoRun()
    : useCinematicStudioRun(models.length + editingModels.length)

  const namespace = computed(() =>
    isCinematicDemo()
      ? creationNamespace({ mode: 'demo' })
      : studio.session.value
        ? creationNamespace({
            mode: 'live',
            uid: studio.session.value.uid,
            workspaceId: studio.session.value.workspace.id
          })
        : undefined
  )
  provide(generationTimingNamespaceKey, namespace)
  const library = useCinematicLibrary(
    () => namespace.value,
    () => studio.reel.value.takes
  )
  const newModeSettings = () => ({
    creative: defaultCreativeSettings(),
    direction: { ...DEFAULT_DIRECTION },
    enhance: true,
    resolution: '2K' as Resolution,
    takes: 1,
    seed: undefined as number | undefined,
    seedBehavior: 'random' as SeedBehavior
  })
  const modeSettings = ref({
    image: newModeSettings(),
    video: newModeSettings()
  })
  const creative = computed({
    get: () => modeSettings.value[mode.value].creative,
    set: (value) => {
      modeSettings.value[mode.value].creative = value
    }
  })
  const creativeOpen = ref(false)
  const builderOpen = ref(false)
  const plannedShot = shallowRef<PlanShotMetadata>()
  const plannerSettings = shallowRef<PlanSettingsSnapshot>()
  async function openBuilder() {
    const scope = namespace.value
    if (!scope || studio.rendering.value) return
    mode.value = 'image'
    const selected = selectedModel.value
    if (!selected) return
    const currentEpoch = mediaEpoch
    const files = referenceSnapshot()
    try {
      const referenceBundleId = await saveReferenceBundle(scope, files)
      if (currentEpoch !== mediaEpoch || namespace.value !== scope) return
      plannerSettings.value = {
        modelSlug: selected.slug,
        modelName: selected.name,
        aspect: aspect.value,
        resolution: resolution.value,
        takes: takes.value,
        enhance: enhance.value,
        seed: seed.value,
        direction: { ...direction.value },
        creative: validateCreativeSettings(creative.value),
        assets: selectedAssets.value.map(({ id, name, kind, notes }) => ({
          id,
          name,
          kind,
          notes
        })),
        referenceBundleId,
        references: files.map((entry) => ({
          id: `${entry.role}:${entry.assetId ?? ''}`,
          label: entry.file.name
        }))
      }
      builderOpen.value = true
    } catch {
      referenceSaveError.value = true
    }
  }
  async function applyBuiltScene(
    value: string,
    plan?: PlanShotMetadata,
    settings?: PlanSettingsSnapshot,
    referenceIds?: readonly string[]
  ) {
    if (settings) {
      if (
        !models.some(
          (model) => model.slug === settings.modelSlug && model.mode !== 'video'
        )
      ) {
        restoreError.value = true
        return
      }
      const scope = namespace.value
      await reuse({
        kind: 'image',
        modelSlug: settings.modelSlug,
        aspect: settings.aspect,
        prompt: value,
        settings: {
          ...settings,
          scene: value,
          mode: 'image',
          operation: 'generate',
          references: settings.references.map((entry) => entry.label)
        }
      })
      if (namespace.value !== scope) return
      if (referenceIds) {
        if (!referenceIds.includes('cast:')) cast.value = undefined
        if (!referenceIds.includes('palette:')) palette.value = undefined
        selectedAssets.value = selectedAssets.value.filter((asset) =>
          referenceIds.includes(`asset:${asset.id}`)
        )
      }
    }
    scene.value = value
    direction.value = { ...direction.value, shot: 'auto' }
    plannedShot.value = plan
  }
  const assetsOpen = ref(false)
  const motionOpen = ref(false)
  const transitionOpen = ref(false)
  const selectedAssets = shallowRef<readonly AssetReference[]>([])
  const assetLimitReached = ref(false)
  function useAsset(asset: AssetReference) {
    if (studio.rendering.value) return
    mediaEpoch += 1
    const remaining = selectedAssets.value.filter(
      (item) => item.id !== asset.id
    )
    if (remaining.length >= 3) {
      assetLimitReached.value = true
      return
    }
    selectedAssets.value = [...remaining, asset]
    assetLimitReached.value = false
    mode.value = 'image'
    assetsOpen.value = false
  }
  function removeAsset(id: string) {
    mediaEpoch += 1
    selectedAssets.value = selectedAssets.value.filter((item) => item.id !== id)
    assetLimitReached.value = false
  }
  const libraryOpen = ref(false)
  const restored = ref(false)
  const preparing = ref(false)
  const referenceSaveError = ref(false)
  const restoreError = ref(false)

  const mode = ref<'image' | 'video'>('image')
  const imageModel = ref(
    models.find((model) => model.mode !== 'video')?.slug ?? ''
  )
  const videoModel = ref(
    models.find((model) => model.mode === 'video')?.slug ?? ''
  )
  const availableModels = computed(() =>
    models.filter((model) => (model.mode ?? 'image') === mode.value)
  )
  const modelSlug = computed({
    get: () => (mode.value === 'video' ? videoModel.value : imageModel.value),
    set: (slug: string) => {
      if (mode.value === 'video') videoModel.value = slug
      else imageModel.value = slug
    }
  })
  const selectedModel = computed(() => {
    const model = availableModels.value.find(
      (item) => item.slug === modelSlug.value
    )
    const referenceModel =
      mode.value === 'image' &&
      (cast.value || palette.value || selectedAssets.value.length)
        ? editingModels.find((item) => item.slug === model?.referenceModelSlug)
        : undefined
    return model && referenceModel
      ? { ...model, imageAspects: referenceModel.imageAspects }
      : model
  })
  const imageScene = ref('')
  const videoScene = ref('')
  const scene = computed({
    get: () => (mode.value === 'video' ? videoScene.value : imageScene.value),
    set: (value: string) => {
      if (mode.value === 'image') plannedShot.value = undefined
      if (mode.value === 'video') videoScene.value = value
      else imageScene.value = value
    }
  })
  const enhance = computed({
    get: () => modeSettings.value[mode.value].enhance,
    set: (value: boolean) => {
      modeSettings.value[mode.value].enhance = value
    }
  })
  const direction = computed({
    get: () => modeSettings.value[mode.value].direction,
    set: (value: Direction) => {
      modeSettings.value[mode.value].direction = value
    }
  })
  const imageAspect = ref<AspectRatio>('21:9')
  const videoAspect = ref<AspectRatio>('16:9')
  const aspect = computed({
    get: () => {
      if (mode.value === 'image')
        return allowedShotAspect(
          imageAspect.value,
          selectedModel.value?.imageAspects,
          '1:1'
        )
      return allowedShotAspect(
        videoAspect.value,
        selectedModel.value?.video?.aspects ?? [],
        '16:9'
      )
    },
    set: (value: AspectRatio) => {
      if (mode.value === 'video') videoAspect.value = value
      else imageAspect.value = value
    }
  })
  const resolution = computed({
    get: () => modeSettings.value[mode.value].resolution,
    set: (value: Resolution) => {
      modeSettings.value[mode.value].resolution = value
    }
  })
  const takes = computed({
    get: () => modeSettings.value[mode.value].takes,
    set: (value: number) => {
      modeSettings.value[mode.value].takes = value
    }
  })
  const requestedSeed = computed({
    get: () => modeSettings.value[mode.value].seed,
    set: (value: number | undefined) => {
      modeSettings.value[mode.value].seed = value
      if (value === undefined)
        modeSettings.value[mode.value].seedBehavior = 'random'
      else if (modeSettings.value[mode.value].seedBehavior === 'random')
        modeSettings.value[mode.value].seedBehavior = 'fixed'
    }
  })
  const seedBehavior = computed({
    get: () => modeSettings.value[mode.value].seedBehavior,
    set: (value: SeedBehavior) => {
      const settings = modeSettings.value[mode.value]
      settings.seedBehavior = value
      if (value === 'random') settings.seed = undefined
      else
        settings.seed ??= Math.max(0, selectedModel.value?.seed?.minimum ?? 0)
    }
  })
  const seed = computed(() => {
    const bounds = selectedModel.value?.seed
    const value = requestedSeed.value
    return value !== undefined && validShotSeed(value, bounds)
      ? value
      : undefined
  })
  const seedValid = computed(
    () =>
      requestedSeed.value === undefined ||
      !selectedModel.value?.seed ||
      seed.value !== undefined
  )
  const cast = shallowRef<File>()
  const palette = shallowRef<File>()
  const review = shallowRef<CinematicReview>()
  const firstFrame = shallowRef<File>()
  const lastFrame = shallowRef<File>()
  const requestedDuration = ref(5)
  const requestedResolution = ref('720p')
  const duration = computed({
    get: () =>
      selectedModel.value?.video?.durations.includes(requestedDuration.value)
        ? requestedDuration.value
        : (selectedModel.value?.video?.defaultDuration ?? 5),
    set: (value: number) => {
      requestedDuration.value = value
    }
  })
  const videoResolution = computed({
    get: () =>
      selectedModel.value?.video?.resolutions.includes(
        requestedResolution.value
      )
        ? requestedResolution.value
        : (selectedModel.value?.video?.defaultResolution ?? '720p'),
    set: (value: string) => {
      requestedResolution.value = value
    }
  })
  const audio = ref(false)
  let mediaEpoch = 0
  onScopeDispose(() => {
    mediaEpoch += 1
  })
  const sourceIdFor = (url: string) =>
    library.items.value.find((item) => library.urls.value[item.id] === url)
      ?.id ??
    studio.reel.value.takes.find(
      (take) => take.status === 'done' && take.output.url === url
    )?.id
  const animationSourceId = ref<string>()
  const endingSourceId = ref<string>()
  watch(
    lastFrame,
    () => {
      endingSourceId.value = undefined
    },
    { flush: 'sync' }
  )
  watch(
    firstFrame,
    () => {
      animationSourceId.value = undefined
    },
    { flush: 'sync' }
  )
  const editSource = shallowRef<{
    file: File
    url: string
    name: string
    id?: string
    recipe?: {
      modelSlug: string
      prompt: string
      aspect: AspectRatio
      takes?: number
      seed?: number
      operation: 'edit' | 'camera' | 'look' | 'relight'
    }
  }>()
  function closeEdit() {
    if (editSource.value) URL.revokeObjectURL(editSource.value.url)
    editSource.value = undefined
  }
  onScopeDispose(closeEdit)
  async function edit(url: string, name: string) {
    if (studio.rendering.value || frameLoading.value || !editingModels.length)
      return
    const currentEpoch = mediaEpoch
    frameLoading.value = true
    frameError.value = false
    try {
      const blob = await fetchShotImage(url)
      if (currentEpoch !== mediaEpoch) return
      closeEdit()
      editSource.value = {
        file: new File([blob], name, { type: blob.type }),
        name,
        id: sourceIdFor(url),
        url: URL.createObjectURL(blob)
      }
    } catch {
      if (currentEpoch === mediaEpoch) frameError.value = true
    } finally {
      if (currentEpoch === mediaEpoch) frameLoading.value = false
    }
  }
  function sourcePlan(sourceId: string | undefined) {
    return (
      library.items.value.find((item) => item.id === sourceId)?.settings
        ?.plan ??
      studio.reel.value.takes.find((take) => take.id === sourceId)?.settings
        ?.plan
    )
  }
  function reviewEdit(input: {
    takes?: number
    seed?: number
    modelSlug: string
    prompt: string
    aspect: AspectRatio
    sourceFile: File
    sourceFiles?: readonly File[]
    operation: 'edit' | 'camera' | 'look' | 'relight'
  }) {
    const model = editingModels.find(
      (candidate) => candidate.slug === input.modelSlug
    )
    if (!model || studio.rendering.value || studio.gate.value !== 'ready')
      return
    const variations = input.takes ?? 1
    const bounds = model.seed
    if (!validEditVariations(variations)) return
    if (input.seed !== undefined && !validShotSeed(input.seed, bounds)) return
    const sourceId = editedSourceId(input.sourceFile)
    review.value = editReview(input, model, variations, sourceId)
  }
  function editedSourceId(file: File) {
    return file === editSource.value?.file ? editSource.value.id : undefined
  }
  function validEditVariations(value: number) {
    return Number.isInteger(value) && value >= 1 && value <= 4
  }
  function editReview(
    input: Parameters<typeof reviewEdit>[0],
    model: CinematicModel,
    variations: number,
    sourceId: string | undefined
  ): CinematicReview {
    return {
      modelName: model.name,
      resolution: '2K',
      workspaceId: studio.session.value?.workspace.id,
      userId: studio.session.value?.uid,
      request: {
        modelSlug: model.slug,
        prompt: input.prompt,
        aspect: input.aspect,
        takes: variations,
        ...(input.seed !== undefined ? { seed: input.seed } : {}),
        resolutionPixels: 2048,
        references: [input.sourceFile, ...(input.sourceFiles ?? [])],
        referenceFiles: [input.sourceFile, ...(input.sourceFiles ?? [])].map(
          (file) => ({ role: 'edit', file })
        ),
        editing: {
          sourceFile: input.sourceFile,
          sourceFiles: input.sourceFiles ? [...input.sourceFiles] : undefined,
          resolution: '2K'
        },
        settings: {
          takes: variations,
          ...(input.seed !== undefined ? { seed: input.seed } : {}),
          mode: 'image',
          scene: input.prompt,
          enhance: false,
          direction: { ...direction.value },
          operation: input.operation,
          sourceId,
          plan: sourcePlan(sourceId),
          references: [input.sourceFile, ...(input.sourceFiles ?? [])].map(
            (file) => file.name
          ),
          aspect: input.aspect
        }
      }
    }
  }
  const frameLoading = ref(false)
  const frameError = ref(false)
  function resetComposer() {
    mediaEpoch += 1
    closeEdit()
    firstFrame.value = undefined
    lastFrame.value = undefined
    cast.value = undefined
    palette.value = undefined
    review.value = undefined
    requestedSeed.value = undefined
    animationSourceId.value = undefined
    endingSourceId.value = undefined
    referenceSaveError.value = false
    plannedShot.value = undefined
    restored.value = false
    restoreError.value = false
    imageScene.value = ''
    videoScene.value = ''
    modeSettings.value = { image: newModeSettings(), video: newModeSettings() }
    mode.value = 'image'
    imageModel.value =
      models.find((model) => model.mode !== 'video')?.slug ?? ''
    videoModel.value =
      models.find((model) => model.mode === 'video')?.slug ?? ''
    imageAspect.value = '21:9'
    videoAspect.value = '16:9'
    requestedDuration.value = 5
    requestedResolution.value = '720p'
    audio.value = false
    builderOpen.value = false
    assetsOpen.value = false
    motionOpen.value = false
    transitionOpen.value = false
    selectedAssets.value = []
    assetLimitReached.value = false
    creativeOpen.value = false
    frameLoading.value = false
    frameError.value = false
  }
  function imageReferencesReady(model: CinematicModel) {
    if (mode.value !== 'image' || !references.value.length) return true
    return (
      !!model.referenceModelSlug &&
      references.value.length <= (model.referenceMax ?? 0)
    )
  }
  function videoFrameReady(model: CinematicModel) {
    if (mode.value !== 'video') return true
    return (
      !!model.video &&
      (model.video.firstFrame !== 'required' || !!firstFrame.value)
    )
  }
  const canReview = computed(() => {
    const model = selectedModel.value
    return (
      !!model &&
      !composerDrafts.hydrating.value &&
      seedValid.value &&
      !frameLoading.value &&
      imageReferencesReady(model) &&
      videoFrameReady(model)
    )
  })
  const formatLabel = computed(() =>
    mode.value === 'video'
      ? `${videoResolution.value} · ${duration.value}s`
      : resolution.value
  )
  const takeCount = computed(() => (mode.value === 'video' ? 1 : takes.value))
  const modeReel = computed(() => ({
    ...studio.reel.value,
    takes: studio.reel.value.takes.filter(
      (take) =>
        (models.find((model) => model.slug === take.modelSlug)?.mode ??
          'image') === mode.value
    )
  }))

  async function useAsReference(url: string, name: string) {
    if (studio.rendering.value || frameLoading.value) return
    const currentEpoch = mediaEpoch
    frameLoading.value = true
    frameError.value = false
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Reference unavailable')
      const blob = await response.blob()
      if (currentEpoch !== mediaEpoch) return
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type))
        throw new Error('Unsupported reference')
      cast.value = new File([blob], name, { type: blob.type })
      mode.value = 'image'
    } catch {
      if (currentEpoch === mediaEpoch) frameError.value = true
    } finally {
      if (currentEpoch === mediaEpoch) frameLoading.value = false
    }
  }

  async function nextShot(item: SavedCreation) {
    const scope = namespace.value
    const url = library.urls.value[item.id]
    if (!scope || !url || studio.rendering.value || item.kind !== 'image')
      return
    const source =
      library.items.value.find(
        (candidate) => candidate.id === item.settings?.sourceId
      ) ?? item
    const generation = models.find(
      (candidate) =>
        candidate.mode !== 'video' &&
        (candidate.slug ===
          (source.settings?.generationModelSlug ?? source.modelSlug) ||
          candidate.referenceModelSlug === source.modelSlug)
    )
    if (!generation) {
      restoreError.value = true
      return
    }
    await reuse({
      ...source,
      modelSlug: generation.slug,
      settings: source.settings
        ? {
            ...source.settings,
            operation: 'generate',
            generationModelSlug: generation.slug
          }
        : undefined
    })
    if (namespace.value === scope) await useAsReference(url, item.fileName)
  }

  async function animate(url: string, name: string) {
    if (studio.rendering.value || frameLoading.value) return
    const model = models.find(
      (candidate) => candidate.video?.firstFrame === 'required'
    )
    if (!model) return
    const currentEpoch = mediaEpoch
    frameLoading.value = true
    frameError.value = false
    try {
      const blob = await fetchShotImage(url)
      if (currentEpoch !== mediaEpoch) return
      firstFrame.value = new File([blob], name, { type: blob.type })
      animationSourceId.value = sourceIdFor(url)
      lastFrame.value = undefined
      videoModel.value = model.slug
      mode.value = 'video'
    } catch {
      if (currentEpoch === mediaEpoch) frameError.value = true
    } finally {
      if (currentEpoch === mediaEpoch) frameLoading.value = false
    }
  }

  const brief = computed(() => ({
    scene: scene.value,
    direction: direction.value,
    enhance: enhance.value,
    mode: mode.value,
    firstFrame:
      mode.value === 'video' &&
      selectedModel.value?.video?.firstFrame === 'required' &&
      !!firstFrame.value,
    lastFrame:
      mode.value === 'video' &&
      !!selectedModel.value?.video?.lastFrame &&
      !!lastFrame.value,
    cast: mode.value === 'image' && !!cast.value,
    palette: mode.value === 'image' && !!palette.value
  }))
  const assetPrompt = computed(() =>
    mode.value === 'image'
      ? assetReferencePrompt(
          selectedAssets.value,
          Number(!!cast.value) + Number(!!palette.value)
        )
      : ''
  )
  const promptSegments = computed(() => [
    ...cinematicPromptSegments(brief.value),
    ...(creativePrompt(creative.value, mode.value)
      ? [
          {
            text: creativePrompt(creative.value, mode.value),
            source: 'direction' as const
          }
        ]
      : []),
    ...(assetPrompt.value
      ? [{ text: assetPrompt.value, source: 'reference' as const }]
      : [])
  ])
  const references = computed(() =>
    (mode.value === 'video'
      ? [
          selectedModel.value?.video?.firstFrame === 'required'
            ? firstFrame.value
            : undefined,
          selectedModel.value?.video?.lastFrame ? lastFrame.value : undefined
        ]
      : [
          cast.value,
          palette.value,
          ...selectedAssets.value.map((asset) => asset.file)
        ]
    ).filter((file): file is File => !!file)
  )

  function videoReferenceSnapshot(): ReferenceFile[] {
    return [
      ...(firstFrame.value &&
      selectedModel.value?.video?.firstFrame !== 'unsupported'
        ? [{ role: 'first' as const, file: firstFrame.value }]
        : []),
      ...(lastFrame.value && selectedModel.value?.video?.lastFrame
        ? [{ role: 'last' as const, file: lastFrame.value }]
        : [])
    ]
  }
  function referenceSnapshot(): ReferenceFile[] {
    if (mode.value === 'video') return videoReferenceSnapshot()
    return [
      ...(cast.value ? [{ role: 'cast' as const, file: cast.value }] : []),
      ...(palette.value
        ? [{ role: 'palette' as const, file: palette.value }]
        : []),
      ...selectedAssets.value.map((asset) => ({
        role: 'asset' as const,
        assetId: asset.id,
        file: asset.file
      }))
    ]
  }

  function choose(part: DirectionPart, id: string) {
    direction.value = { ...direction.value, [part]: id }
  }

  function start(shot: StarterShot) {
    scene.value = shot.scene
    direction.value = shot.direction
    aspect.value = shot.aspect
  }

  function shotSeed() {
    return seed.value !== undefined ? { seed: seed.value } : {}
  }
  function videoSettings() {
    return {
      durationSeconds: duration.value,
      resolution: videoResolution.value,
      generateAudio: !!selectedModel.value?.video?.generateAudio && audio.value
    }
  }
  function videoFrameSettings() {
    const video = selectedModel.value?.video
    return {
      ...(video?.firstFrame === 'required' && firstFrame.value
        ? { firstFrame: firstFrame.value }
        : {}),
      ...(video?.lastFrame && lastFrame.value
        ? { lastFrame: lastFrame.value }
        : {})
    }
  }
  function savedShotSettings(model: CinematicModel): CreationSettings {
    return {
      lastSourceId: mode.value === 'video' ? endingSourceId.value : undefined,
      generationModelSlug: model.slug,
      plan: plannedShot.value,
      sourceId: mode.value === 'video' ? animationSourceId.value : undefined,
      references: references.value.map((file) => file.name),
      assets:
        mode.value === 'image'
          ? selectedAssets.value.map(({ id, name, kind, notes }) => ({
              id,
              name,
              kind,
              notes
            }))
          : [],
      creative: validateCreativeSettings(creative.value),
      scene: scene.value,
      mode: mode.value,
      enhance: enhance.value,
      direction: { ...direction.value },
      aspect: aspect.value,
      resolution: resolution.value,
      takes: takeCount.value,
      operation: 'generate',
      ...shotSeed(),
      ...(mode.value === 'video'
        ? { duration: duration.value, video: videoSettings() }
        : {})
    }
  }
  function shotRequest(
    model: CinematicModel,
    referenceModel: string | undefined
  ): ShotRequest {
    return {
      modelSlug: referenceModel ?? modelSlug.value,
      ...(referenceModel && referenceModel !== model.slug
        ? {
            editing: {
              sourceFile: references.value[0],
              sourceFiles: references.value.slice(1),
              resolution: resolution.value
            }
          }
        : {}),
      prompt: [
        cinematicPrompt(brief.value),
        creativePrompt(creative.value, mode.value),
        assetPrompt.value
      ]
        .filter(Boolean)
        .join(' '),
      aspect: aspect.value,
      resolutionPixels:
        RESOLUTIONS.find((option) => option.id === resolution.value)?.pixels ??
        2048,
      takes: takeCount.value,
      ...shotSeed(),
      references: mode.value === 'image' ? [...references.value] : [],
      referenceFiles: referenceSnapshot(),
      ...(mode.value === 'video'
        ? {
            video: {
              ...shotSeed(),
              ...videoSettings(),
              ...videoFrameSettings()
            }
          }
        : {}),
      settings: savedShotSettings(model),
      preview: directionOption('look', direction.value).preview
    }
  }
  function shotReview(
    model: CinematicModel,
    referenceModel: string | undefined
  ): CinematicReview {
    return {
      ...(model.seed
        ? {
            seedUpdate: {
              modelSlug: model.slug,
              mode: mode.value,
              behavior: seedBehavior.value,
              bounds: model.seed
            }
          }
        : {}),
      modelName: referenceModel
        ? (editingModels.find((entry) => entry.slug === referenceModel)?.name ??
          model.name)
        : model.name,
      resolution: formatLabel.value,
      adaptiveAspect: mode.value === 'video' && !model.video?.aspects.length,
      workspaceId: studio.session.value?.workspace.id,
      userId: studio.session.value?.uid,
      request: shotRequest(model, referenceModel)
    }
  }
  function generate() {
    const model = models.find((item) => item.slug === modelSlug.value)
    if (
      !model ||
      !canReview.value ||
      !scene.value.trim() ||
      studio.rendering.value ||
      studio.gate.value !== 'ready'
    )
      return
    const referenceModel =
      mode.value === 'image' && references.value.length
        ? model.referenceModelSlug
        : undefined
    review.value = shotReview(model, referenceModel)
  }

  const canConfirm = computed(
    () =>
      !!review.value &&
      !preparing.value &&
      studio.gate.value === 'ready' &&
      !studio.rendering.value &&
      review.value.workspaceId === studio.session.value?.workspace.id &&
      review.value.userId === studio.session.value?.uid
  )

  function restoreShotText(item: ReusableShot) {
    scene.value = item.settings?.scene ?? item.prompt
    enhance.value = item.settings?.enhance ?? false
    if (item.settings) direction.value = { ...item.settings.direction }
  }
  function restoreShotOutput(item: ReusableShot) {
    aspect.value = item.aspect
    resolution.value = item.settings?.resolution ?? '2K'
    takes.value = item.settings?.takes ?? 1
    requestedSeed.value = item.settings?.seed
    seedBehavior.value = item.settings?.seed === undefined ? 'random' : 'fixed'
  }
  function restoreShotMediaSettings(item: ReusableShot) {
    if (item.kind === 'video') {
      restoreVideoSettings(item)
      firstFrame.value = undefined
      lastFrame.value = undefined
    } else {
      cast.value = undefined
      palette.value = undefined
      selectedAssets.value = []
    }
  }
  function restoreVideoSettings(item: ReusableShot) {
    duration.value =
      item.settings?.video?.durationSeconds ?? item.settings?.duration ?? 5
    videoResolution.value = item.settings?.video?.resolution ?? '720p'
    audio.value = item.settings?.video?.generateAudio ?? false
  }
  function restoreShotCreative(item: ReusableShot) {
    creative.value = item.settings?.creative
      ? validateCreativeSettings(item.settings.creative)
      : defaultCreativeSettings()
    if (item.kind === 'image') plannedShot.value = item.settings?.plan
  }
  async function reuse(item: ReusableShot) {
    if (
      studio.rendering.value ||
      (item.settings?.operation && item.settings.operation !== 'generate')
    )
      return
    const supported = models.find(
      (model) =>
        model.slug === (item.settings?.generationModelSlug ?? item.modelSlug)
    )
    if (!supported || (supported.mode ?? 'image') !== item.kind) {
      restoreError.value = true
      return
    }
    mediaEpoch += 1
    restoreError.value = false
    mode.value = item.kind
    modelSlug.value = supported.slug
    restoreShotText(item)
    restoreShotOutput(item)
    restoreShotMediaSettings(item)
    restoreShotCreative(item)
    restored.value = true
    const currentEpoch = mediaEpoch
    const scope = namespace.value
    if (await restoreShotReferences(item, scope, currentEpoch)) return
    await restoreLegacyAssets(item, scope, currentEpoch)
  }
  function applyImageReferences(item: ReusableShot, files: ReferenceFile[]) {
    cast.value = files.find((entry) => entry.role === 'cast')?.file
    palette.value = files.find((entry) => entry.role === 'palette')?.file
    selectedAssets.value = (item.settings?.assets ?? []).flatMap((asset) => {
      const entry = files.find(
        (reference) =>
          reference.role === 'asset' && reference.assetId === asset.id
      )
      return entry ? [{ ...asset, file: entry.file }] : []
    })
  }
  function applyShotReferences(item: ReusableShot, files: ReferenceFile[]) {
    if (item.kind === 'image') {
      applyImageReferences(item, files)
    } else {
      firstFrame.value = files.find((entry) => entry.role === 'first')?.file
      lastFrame.value = files.find((entry) => entry.role === 'last')?.file
      animationSourceId.value = item.settings?.sourceId
      endingSourceId.value = item.settings?.lastSourceId
    }
  }
  async function restoreShotReferences(
    item: ReusableShot,
    scope: string | undefined,
    currentEpoch: number
  ) {
    if (scope && item.settings?.referenceBundleId) {
      try {
        const files = await loadReferenceBundle(
          scope,
          item.settings.referenceBundleId
        )
        if (currentEpoch !== mediaEpoch) return true
        applyShotReferences(item, files)
        return true
      } catch {
        if (currentEpoch === mediaEpoch) restoreError.value = true
      }
    }
    return false
  }
  async function restoreLegacyAssets(
    item: ReusableShot,
    scope: string | undefined,
    currentEpoch: number
  ) {
    if (item.kind === 'image' && scope && item.settings?.assets?.length) {
      try {
        const saved = await listAssets(scope)
        if (currentEpoch !== mediaEpoch) return
        selectedAssets.value = item.settings.assets.flatMap((reference) => {
          const asset = saved.find((entry) => entry.id === reference.id)
          return asset ? [{ ...reference, file: assetFile(asset) }] : []
        })
      } catch {
        if (currentEpoch === mediaEpoch) restoreError.value = true
      }
    }
  }

  function editRecipeSettings(recipe: CinematicRecipeImport['recipe']) {
    return { takes: recipe.settings?.takes, seed: recipe.settings?.seed }
  }
  function importRecipe({ recipe, source }: CinematicRecipeImport) {
    if (studio.rendering.value) return
    const operation = recipe.settings?.operation
    if (operation && operation !== 'generate') {
      if (
        !source ||
        !editingModels.some((model) => model.slug === recipe.modelSlug)
      )
        return
      closeEdit()
      mode.value = 'image'
      editSource.value = {
        file: source,
        name: source.name,
        url: URL.createObjectURL(source),
        recipe: {
          ...editRecipeSettings(recipe),
          modelSlug: recipe.modelSlug,
          prompt: recipe.prompt,
          aspect: recipe.aspect,
          operation
        }
      }
      reviewEdit({
        ...editRecipeSettings(recipe),
        modelSlug: recipe.modelSlug,
        prompt: recipe.prompt,
        aspect: recipe.aspect,
        sourceFile: source,
        operation
      })
    } else void reuse(recipe)
  }

  function applyTransition(input: CinematicTransitionApply) {
    if (
      studio.rendering.value ||
      !models.some(
        (model) => model.slug === input.modelSlug && model.video?.lastFrame
      )
    )
      return
    mode.value = 'video'
    modelSlug.value = input.modelSlug
    firstFrame.value = input.firstFrame
    lastFrame.value = input.lastFrame
    animationSourceId.value = input.firstSourceId
    endingSourceId.value = input.lastSourceId
    if (input.scene) scene.value = input.scene
    transitionOpen.value = false
  }
  function reviewMotion(input: MotionComparisonPayload) {
    const model = models.find((item) => item.slug === input.modelSlug)
    if (
      !model ||
      !model.video ||
      !input.clips.length ||
      input.clips.length > 3 ||
      studio.rendering.value ||
      studio.gate.value !== 'ready'
    )
      return
    const batch: ShotRequest[] = input.clips.map((clip) => ({
      modelSlug: model.slug,
      prompt: clip.prompt,
      aspect: input.aspect,
      resolutionPixels: 2048,
      takes: 1,
      references: [],
      referenceFiles: [{ role: 'first', file: input.sourceFile }],
      seed: input.seed,
      video: {
        firstFrame: input.sourceFile,
        durationSeconds: input.durationSeconds,
        resolution: input.resolution,
        generateAudio: input.generateAudio,
        seed: input.seed
      },
      settings: {
        mode: 'video',
        scene: clip.prompt,
        enhance: false,
        direction: AUTO_DIRECTION,
        sourceId: input.sourceId,
        aspect: input.aspect,
        operation: 'generate',
        seed: input.seed,
        takes: 1,
        references: [input.sourceFile.name],
        video: {
          durationSeconds: input.durationSeconds,
          resolution: input.resolution,
          generateAudio: input.generateAudio
        }
      }
    }))
    review.value = {
      modelName: model.name,
      resolution: `${input.resolution} · ${input.durationSeconds}s`,
      adaptiveAspect: !model.video.aspects.length,
      workspaceId: studio.session.value?.workspace.id,
      userId: studio.session.value?.uid,
      batch,
      request: { ...batch[0], takes: batch.length }
    }
  }

  const seedSubscriptions = new Set<() => void>()
  onScopeDispose(() => seedSubscriptions.forEach((stop) => stop()))

  function observeSeedCompletion(
    snapshot: CinematicReview,
    request: ShotRequest,
    ids: string[],
    scope: string
  ) {
    const update = snapshot.seedUpdate
    if (update && request.seed !== undefined && ids.length) {
      const enteredSeed = request.seed
      const stop = watch(
        () => studio.reel.value,
        (reel) => {
          const completed = reel.takes.filter((take) => ids.includes(take.id))
          if (completed.some((take) => take.status === 'rendering')) return
          stop()
          seedSubscriptions.delete(stop)
          const settings = modeSettings.value[update.mode]
          if (
            namespace.value === scope &&
            (update.mode === 'image' ? imageModel.value : videoModel.value) ===
              update.modelSlug &&
            completed.length === ids.length &&
            completed.every((take) => take.status === 'done') &&
            settings.seed === enteredSeed &&
            settings.seedBehavior === update.behavior
          ) {
            settings.seed = nextSeed(
              enteredSeed,
              update.behavior,
              update.bounds
            )
          }
        }
      )
      seedSubscriptions.add(stop)
    }
  }
  function dispatchReviewedShot(
    snapshot: CinematicReview,
    request: ShotRequest,
    referenceBundleId: string | undefined,
    scope: string
  ) {
    if (snapshot.batch) {
      motionOpen.value = false
      mode.value = 'video'
      void studio.generateBatch(
        snapshot.batch.map((clip) => ({
          ...clip,
          settings: clip.settings
            ? { ...clip.settings, referenceBundleId }
            : undefined
        }))
      )
    } else {
      const previousIds = new Set(
        studio.reel.value.takes.map((take) => take.id)
      )
      const completion = studio.generate(request)
      const ids = studio.reel.value.takes
        .filter((take) => !previousIds.has(take.id))
        .map((take) => take.id)
      observeSeedCompletion(snapshot, request, ids, scope)
      void completion
    }
  }
  function prepareReviewedRequest(
    source: ShotRequest,
    referenceBundleId: string | undefined
  ) {
    const request = {
      ...source,
      settings: source.settings
        ? { ...source.settings, referenceBundleId }
        : undefined
    }
    if (request.editing) {
      closeEdit()
      mode.value = 'image'
    }
    return request
  }
  async function confirm() {
    const snapshot = review.value
    const scope = namespace.value
    if (!snapshot || !canConfirm.value || !scope) return
    preparing.value = true
    referenceSaveError.value = false
    try {
      const referenceBundleId = await saveReferenceBundle(
        scope,
        snapshot.request.referenceFiles ?? []
      )
      if (review.value !== snapshot || namespace.value !== scope) return
      const request = prepareReviewedRequest(
        snapshot.request,
        referenceBundleId
      )
      review.value = undefined
      dispatchReviewedShot(snapshot, request, referenceBundleId, scope)
    } catch {
      if (namespace.value === scope) referenceSaveError.value = true
    } finally {
      preparing.value = false
    }
  }

  function composerFiles(): Record<'image' | 'video', ReferenceFile[]> {
    return {
      image: [
        ...(cast.value ? [{ role: 'cast' as const, file: cast.value }] : []),
        ...(palette.value
          ? [{ role: 'palette' as const, file: palette.value }]
          : []),
        ...selectedAssets.value.map((asset) => ({
          role: 'asset' as const,
          assetId: asset.id,
          file: asset.file
        }))
      ],
      video: [
        ...(firstFrame.value
          ? [{ role: 'first' as const, file: firstFrame.value }]
          : []),
        ...(lastFrame.value
          ? [{ role: 'last' as const, file: lastFrame.value }]
          : [])
      ]
    }
  }
  function draftFor(kind: 'image' | 'video'): ComposerModeDraft {
    const settings = modeSettings.value[kind]
    return {
      modelSlug: kind === 'image' ? imageModel.value : videoModel.value,
      scene: kind === 'image' ? imageScene.value : videoScene.value,
      direction: { ...settings.direction },
      creative: validateCreativeSettings(settings.creative),
      enhance: settings.enhance,
      resolution: settings.resolution,
      takes: settings.takes,
      seed: settings.seed,
      seedBehavior: settings.seedBehavior,
      aspect: kind === 'image' ? imageAspect.value : videoAspect.value,
      references: composerFiles()[kind].map((entry) => entry.file.name),
      ...(kind === 'image'
        ? {
            assets: selectedAssets.value.map(({ id, name, kind, notes }) => ({
              id,
              name,
              kind,
              notes
            })),
            plan: plannedShot.value
          }
        : {
            video: {
              durationSeconds: requestedDuration.value,
              resolution: requestedResolution.value,
              generateAudio: audio.value
            },
            sourceId: animationSourceId.value,
            lastSourceId: endingSourceId.value
          })
    }
  }
  function restoredModeSettings(saved: ComposerModeDraft) {
    return {
      direction: { ...saved.direction },
      creative: saved.creative
        ? validateCreativeSettings(saved.creative)
        : defaultCreativeSettings(),
      enhance: saved.enhance,
      resolution: saved.resolution ?? '2K',
      takes: saved.takes ?? 1,
      seed: saved.seed,
      seedBehavior:
        saved.seedBehavior ?? (saved.seed === undefined ? 'random' : 'fixed')
    }
  }
  function restoreVideoComposer(saved: ComposerModeDraft) {
    videoModel.value = saved.modelSlug
    videoScene.value = saved.scene
    videoAspect.value = saved.aspect ?? '16:9'
    requestedDuration.value = saved.video?.durationSeconds ?? 5
    requestedResolution.value = saved.video?.resolution ?? '720p'
    audio.value = saved.video?.generateAudio ?? false
  }
  function restoreComposerMedia(
    kind: 'image' | 'video',
    saved: ComposerModeDraft
  ) {
    if (kind === 'image') {
      imageModel.value = saved.modelSlug
      imageScene.value = saved.scene
      imageAspect.value = saved.aspect ?? '21:9'
      plannedShot.value = saved.plan
    } else {
      restoreVideoComposer(saved)
    }
  }
  function restoreComposer(draft: ComposerDrafts) {
    for (const kind of ['image', 'video'] as const) {
      const saved = draft[kind]
      modeSettings.value[kind] = restoredModeSettings(saved)
      const available = models.some(
        (model) =>
          model.slug === saved.modelSlug && (model.mode ?? 'image') === kind
      )
      if (saved.modelSlug && !available) restoreError.value = true
      restoreComposerMedia(kind, saved)
    }
    mode.value = draft.mode
  }
  const composerDrafts = useCinematicComposerDrafts({
    namespace: () => namespace.value,
    read: () => ({
      version: 1,
      mode: mode.value,
      image: draftFor('image'),
      video: draftFor('video')
    }),
    files: composerFiles,
    reset: resetComposer,
    apply: restoreComposer,
    applyFiles: (kind, files, draft) => {
      if (kind === 'image') {
        cast.value = files.find((entry) => entry.role === 'cast')?.file
        palette.value = files.find((entry) => entry.role === 'palette')?.file
        selectedAssets.value = (draft.image.assets ?? []).flatMap((asset) => {
          const file = files.find(
            (entry) => entry.role === 'asset' && entry.assetId === asset.id
          )?.file
          return file ? [{ ...asset, file }] : []
        })
      } else {
        firstFrame.value = files.find((entry) => entry.role === 'first')?.file
        lastFrame.value = files.find((entry) => entry.role === 'last')?.file
        animationSourceId.value = draft.video.sourceId
        endingSourceId.value = draft.video.lastSourceId
      }
    },
    error: (kind) => {
      if (kind === 'read') restoreError.value = true
      else referenceSaveError.value = true
    }
  })
  onMounted(() => {
    const requested = new URLSearchParams(window.location.search).get('model')
    const selected = models.find((model) => model.slug === requested)
    if (selected) {
      mode.value = selected.mode ?? 'image'
      modelSlug.value = selected.slug
    }
  })

  return {
    studio,
    namespace,
    creative,
    creativeOpen,
    builderOpen,
    openBuilder,
    plannerSettings,
    applyBuiltScene,
    restoreError,
    assetsOpen,
    motionOpen,
    transitionOpen,
    reviewMotion,
    applyTransition,
    selectedAssets,
    assetLimitReached,
    useAsset,
    removeAsset,
    edit,
    editSource,
    closeEdit,
    reviewEdit,
    library,
    libraryOpen,
    reuse,
    importRecipe,
    restored,
    referenceSaveError,
    preparing,
    mode,
    availableModels,
    selectedModel,
    firstFrame,
    lastFrame,
    duration,
    videoResolution,
    audio,
    canReview,
    formatLabel,
    takeCount,
    modeReel,
    animate,
    useAsReference,
    nextShot,
    frameLoading,
    frameError,
    modelSlug,
    scene,
    enhance,
    direction,
    aspect,
    resolution,
    takes,
    requestedSeed,
    seedBehavior,
    cast,
    palette,
    promptSegments,
    references,
    review,
    canConfirm,
    confirm,
    choose,
    start,
    generate
  }
}
