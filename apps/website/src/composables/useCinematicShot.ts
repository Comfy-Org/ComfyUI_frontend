import { computed, onMounted, ref, shallowRef, watchEffect } from 'vue'

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
import { shotEstimate } from '../lib/workshop/cinematic-studio/estimate'
import type { CinematicModel } from '../lib/workshop/cinematic-studio/models'
import {
  shotAspects,
  takesReferences
} from '../lib/workshop/cinematic-studio/models'
import { nearestAspect } from '../lib/workshop/cinematic-studio/frames'
import { cinematicPrompt } from '../lib/workshop/cinematic-studio/prompt'
import type { StarterShot } from '../lib/workshop/cinematic-studio/starters'
import { isCinematicDemo, useCinematicDemoRun } from './useCinematicDemoRun'
import { useCinematicStudioRun } from './useCinematicStudioRun'

/** The shot being directed, shared by every Cinematic Studio layout. */
export function useCinematicShot(models: readonly CinematicModel[]) {
  const modelSlug = ref(models[0]?.slug ?? '')
  const scene = ref('')
  const enhance = ref(true)
  const direction = ref<Direction>(DEFAULT_DIRECTION)
  const aspect = ref<AspectRatio>('21:9')
  const resolution = ref<Resolution>('2K')
  const takes = ref(1)
  const cast = shallowRef<File>()
  const palette = shallowRef<File>()
  const colors = ref<readonly string[]>([])
  const mainColor = ref<number>()

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
    palette: !!palette.value,
    colors: colors.value,
    mainColor: mainColor.value
  }))
  const references = computed(() =>
    [cast.value, palette.value].filter((file): file is File => !!file)
  )
  const model = computed(() =>
    models.find((option) => option.slug === modelSlug.value)
  )
  const aspects = computed(() =>
    shotAspects(model.value, references.value.length > 0)
  )
  // A model that cannot make the chosen frame moves it to its nearest one.
  watchEffect(() => {
    if (aspects.value) aspect.value = nearestAspect(aspect.value, aspects.value)
  })
  const estimate = computed(() =>
    shotEstimate(model.value?.prices, {
      aspect: aspect.value,
      resolution: resolution.value,
      references: references.value.length,
      takes: takes.value
    })
  )

  const studio = isCinematicDemo()
    ? useCinematicDemoRun()
    : useCinematicStudioRun(models.length, () => estimate.value?.total.min)

  const memberWorkspace = computed(() =>
    studio.session.value?.role === 'member'
      ? studio.session.value.workspace.name
      : undefined
  )

  function choose(part: DirectionPart, id: string) {
    direction.value = { ...direction.value, [part]: id }
  }

  function start(shot: StarterShot) {
    scene.value = shot.scene
    direction.value = shot.direction
    aspect.value = shot.aspect
  }

  const canGenerate = computed(
    () =>
      studio.gate.value === 'ready' &&
      scene.value.trim().length > 0 &&
      takesReferences(model.value, references.value.length)
  )

  function generate() {
    if (!canGenerate.value) return
    void studio.generate({
      modelSlug: modelSlug.value,
      referenceSlug: model.value?.referenceSlug,
      prompt: cinematicPrompt(brief.value),
      aspect: aspect.value,
      resolutionPixels:
        RESOLUTIONS.find((option) => option.id === resolution.value)?.pixels ??
        2048,
      takes: takes.value,
      references: references.value,
      preview: directionOption('look', direction.value).preview
    })
  }

  return {
    studio,
    modelSlug,
    scene,
    enhance,
    direction,
    aspect,
    aspects,
    resolution,
    takes,
    cast,
    palette,
    colors,
    mainColor,
    references,
    estimate,
    memberWorkspace,
    choose,
    start,
    generate
  }
}
