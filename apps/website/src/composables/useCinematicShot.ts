import { computed, onMounted, ref, shallowRef } from 'vue'

import type {
  AspectRatio,
  Direction,
  DirectionPart,
  Resolution
} from '../lib/workshop/cinematic-studio/catalog'
import {
  DEFAULT_DIRECTION,
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
  readonly request: ShotRequest
  readonly modelName: string
  readonly resolution: Resolution
  readonly workspaceId?: string
  readonly userId?: string
}

/** The shot being directed, shared by every Cinematic Studio layout. */
export function useCinematicShot(models: readonly CinematicModel[]) {
  const studio = isCinematicDemo()
    ? useCinematicDemoRun()
    : useCinematicStudioRun(models.length)

  const modelSlug = ref(models[0]?.slug ?? '')
  const scene = ref('')
  const enhance = ref(true)
  const direction = ref<Direction>(DEFAULT_DIRECTION)
  const aspect = ref<AspectRatio>('21:9')
  const resolution = ref<Resolution>('2K')
  const takes = ref(1)
  const cast = shallowRef<File>()
  const palette = shallowRef<File>()
  const review = shallowRef<CinematicReview>()

  onMounted(() => {
    const requested = new URLSearchParams(window.location.search).get('model')
    if (requested && models.some((model) => model.slug === requested))
      modelSlug.value = requested
  })

  const brief = computed(() => ({
    scene: scene.value,
    direction: direction.value,
    enhance: enhance.value,
    cast: !!cast.value,
    palette: !!palette.value
  }))
  const promptSegments = computed(() => cinematicPromptSegments(brief.value))
  const references = computed(() =>
    [cast.value, palette.value].filter((file): file is File => !!file)
  )

  function choose(part: DirectionPart, id: string) {
    direction.value = { ...direction.value, [part]: id }
  }

  function start(shot: StarterShot) {
    scene.value = shot.scene
    direction.value = shot.direction
    aspect.value = shot.aspect
  }

  function generate() {
    const model = models.find((item) => item.slug === modelSlug.value)
    if (
      !model ||
      !scene.value.trim() ||
      studio.rendering.value ||
      studio.gate.value !== 'ready'
    )
      return
    review.value = {
      modelName: model.name,
      resolution: resolution.value,
      workspaceId: studio.session.value?.workspace.id,
      userId: studio.session.value?.uid,
      request: {
        modelSlug: modelSlug.value,
        prompt: cinematicPrompt(brief.value),
        aspect: aspect.value,
        resolutionPixels:
          RESOLUTIONS.find((option) => option.id === resolution.value)
            ?.pixels ?? 2048,
        takes: takes.value,
        references: [...references.value],
        preview: directionOption('look', direction.value).preview
      }
    }
  }

  const canConfirm = computed(
    () =>
      !!review.value &&
      studio.gate.value === 'ready' &&
      !studio.rendering.value &&
      review.value.workspaceId === studio.session.value?.workspace.id &&
      review.value.userId === studio.session.value?.uid
  )

  function confirm() {
    if (!review.value || !canConfirm.value) return
    const request = review.value.request
    review.value = undefined
    void studio.generate(request)
  }

  return {
    studio,
    modelSlug,
    scene,
    enhance,
    direction,
    aspect,
    resolution,
    takes,
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
