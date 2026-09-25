<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { Locale } from '../../../i18n/translations'
import type {
  CinematicRecipe,
  CinematicRecipeImport,
  RecipeModel
} from '../../../lib/workshop/cinematic-studio/recipes'
import {
  availableRecipeModel,
  parseCinematicRecipe,
  recipeNeedsSource,
  validateRecipeSource
} from '../../../lib/workshop/cinematic-studio/recipes'
import { tcRecipe } from '../../../lib/workshop/cinematic-studio/recipe-copy'
import Button from '../../ui/button/Button.vue'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'

const {
  open,
  namespace,
  models,
  editingModels = [],
  locale = 'en'
} = defineProps<{
  open: boolean
  namespace: string | undefined
  models: readonly RecipeModel[]
  editingModels?: readonly RecipeModel[]
  locale?: Locale
}>()
const emit = defineEmits<{
  'update:open': [boolean]
  apply: [value: CinematicRecipeImport]
}>()
const recipe = shallowRef<CinematicRecipe>()
const source = shallowRef<File>()
const error = ref('')
const reading = ref(false)
let revision = 0
const t = (key: Parameters<typeof tcRecipe>[0]) => tcRecipe(key, locale)
const model = computed(() =>
  recipe.value
    ? availableRecipeModel(recipe.value, models, editingModels)
    : undefined
)
const needsSource = computed(
  () => !!recipe.value && recipeNeedsSource(recipe.value)
)
const canApply = computed(
  () =>
    !!namespace &&
    !!recipe.value &&
    !!model.value &&
    !reading.value &&
    (!needsSource.value || !!source.value)
)
watch(
  () => [open, namespace] as const,
  () => {
    revision++
    recipe.value = undefined
    source.value = undefined
    error.value = ''
    reading.value = false
  }
)

async function choose(event: Event, kind: 'recipe' | 'source') {
  if (!(event.target instanceof HTMLInputElement)) return
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || !open || !namespace) return
  const current = ++revision
  error.value = ''
  reading.value = true
  source.value = undefined
  if (kind === 'recipe') recipe.value = undefined
  try {
    if (kind === 'recipe') {
      if (file.size > 1000000) throw new Error('Recipe too large')
      const parsed = parseCinematicRecipe(await file.text())
      if (current === revision && open) recipe.value = parsed
    } else {
      const validated = await validateRecipeSource(file)
      if (current === revision && open) source.value = validated
    }
  } catch {
    if (current === revision)
      error.value = t(kind === 'recipe' ? 'error' : 'sourceError')
  } finally {
    if (current === revision) reading.value = false
  }
}

function apply() {
  if (!canApply.value || !recipe.value) return
  emit('apply', {
    recipe: recipe.value,
    ...(source.value ? { source: source.value } : {})
  })
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="flex max-h-[90dvh] flex-col gap-4 overflow-y-auto sm:max-w-2xl"
      :close-label="t('cancel')"
    >
      <DialogTitle class="pr-12">{{ t('title') }}</DialogTitle>
      <DialogDescription>{{ t('description') }}</DialogDescription>
      <p
        v-if="!namespace"
        role="status"
        class="text-sm text-primary-comfy-canvas"
      >
        {{ t('chooseAccount') }}
      </p>
      <label
        class="flex min-w-0 flex-col gap-2 text-sm text-primary-warm-white"
      >
        {{ t('choose') }}
        <input
          type="file"
          accept="application/json,.json"
          :disabled="!namespace || reading"
          class="w-full min-w-0 text-sm"
          @change="choose($event, 'recipe')"
        />
      </label>
      <p v-if="error" role="alert" class="text-sm text-primary-warm-white">
        {{ error }}
      </p>
      <template v-if="recipe">
        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-primary-comfy-canvas">{{ t('model') }}</dt>
            <dd class="mt-1 text-primary-warm-white">
              {{ model?.name ?? t('unavailable') }}
            </dd>
          </div>
          <div>
            <dt class="text-primary-comfy-canvas">{{ t('format') }}</dt>
            <dd class="mt-1 text-primary-warm-white">{{ recipe.aspect }}</dd>
          </div>
        </dl>
        <p v-if="!model" role="alert" class="text-sm text-primary-warm-white">
          {{ t('unsupported') }}
        </p>
        <section class="min-w-0">
          <h3 class="mb-2 text-sm font-semibold text-primary-warm-white">
            {{ t('preview') }}
          </h3>
          <p
            class="max-h-48 overflow-auto rounded-xl border border-transparency-white-t8 p-3 text-sm/relaxed wrap-break-word whitespace-pre-wrap text-primary-comfy-canvas"
          >
            {{ recipe.prompt }}
          </p>
        </section>
        <details
          v-if="recipe.settings"
          class="min-w-0 text-sm text-primary-comfy-canvas"
        >
          <summary class="cursor-pointer">{{ t('settings') }}</summary>
          <pre
            class="mt-2 max-h-48 overflow-auto text-xs wrap-break-word whitespace-pre-wrap"
            >{{ JSON.stringify(recipe.settings, null, 2) }}</pre>
        </details>
        <p class="text-sm text-primary-comfy-canvas">{{ t('references') }}</p>
        <label
          v-if="needsSource"
          class="flex min-w-0 flex-col gap-2 text-sm text-primary-warm-white"
        >
          {{ t('source') }}
          <span class="text-primary-comfy-canvas">{{ t('sourceHelp') }}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            :disabled="reading"
            class="w-full min-w-0 text-sm"
            @change="choose($event, 'source')"
          />
          <span v-if="source" class="wrap-break-word">{{ source.name }}</span>
        </label>
      </template>
      <div class="flex flex-wrap justify-end gap-2">
        <Button variant="outline" @click="emit('update:open', false)">{{
          t('cancel')
        }}</Button>
        <Button :disabled="!canApply" @click="apply">{{ t('apply') }}</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
