<template>
  <div class="flex min-h-0 flex-1 flex-col gap-6 px-6 py-4">
    <label class="flex flex-col gap-2">
      <span class="text-sm text-base-foreground">
        {{ $t('workflowSharing.workflowName') }}
      </span>
      <Input
        :model-value="name"
        :placeholder="$t('workflowSharing.publish.workflowNamePlaceholder')"
        @update:model-value="$emit('update:name', String($event))"
      />
    </label>

    <label class="flex flex-col gap-2">
      <span class="text-sm text-base-foreground">
        {{ $t('workflowSharing.publish.workflowDescription') }}
      </span>
      <Textarea
        :model-value="description"
        :placeholder="
          $t('workflowSharing.publish.workflowDescriptionPlaceholder')
        "
        rows="5"
        @update:model-value="$emit('update:description', String($event))"
      />
    </label>

    <label class="flex flex-col gap-2">
      <span class="text-sm text-base-foreground">
        {{ $t('workflowSharing.publish.workflowType') }}
      </span>
      <Select
        :model-value="workflowType"
        @update:model-value="
          emit('update:workflowType', $event as ComfyHubWorkflowType)
        "
      >
        <SelectTrigger>
          <SelectValue
            :placeholder="$t('workflowSharing.publish.workflowTypePlaceholder')"
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="option in workflowTypeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </label>

    <fieldset class="flex flex-col gap-2">
      <legend class="text-sm text-base-foreground">
        {{ $t('workflowSharing.publish.tagsDescription') }}
      </legend>
      <TagsInput
        v-slot="{ isEmpty }"
        always-editing
        class="bg-secondary-background select-none"
        :model-value="tags"
        @update:model-value="$emit('update:tags', $event as string[])"
      >
        <TagsInputItem v-for="tag in tags" :key="tag" :value="tag">
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput :is-empty />
      </TagsInput>

      <TagsInput
        disabled
        class="hover-within:bg-transparent bg-transparent p-0 hover:bg-transparent"
      >
        <div
          v-if="displayedSuggestions.length > 0"
          class="flex basis-full flex-wrap gap-2"
        >
          <TagsInputItem
            v-for="tag in displayedSuggestions"
            :key="tag"
            v-auto-animate
            :value="tag"
            class="cursor-pointer bg-secondary-background px-2 text-muted-foreground transition-colors select-none hover:bg-secondary-background-selected"
            @click="addTag(tag)"
          >
            <TagsInputItemText />
          </TagsInputItem>
        </div>
        <Button
          v-if="shouldShowSuggestionToggle"
          variant="muted-textonly"
          size="unset"
          class="hover:bg-unset px-0 text-xs"
          @click="showAllSuggestions = !showAllSuggestions"
        >
          {{
            $t(
              showAllSuggestions
                ? 'workflowSharing.publish.showLessTags'
                : 'workflowSharing.publish.showMoreTags'
            )
          }}
        </Button>
      </TagsInput>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { COMFY_HUB_TAG_OPTIONS } from '@/platform/workflow/sharing/constants/comfyHubTags'
import type { ComfyHubWorkflowType } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { vAutoAnimate } from '@formkit/auto-animate/vue'

const { tags, workflowType } = defineProps<{
  name: string
  description: string
  workflowType: ComfyHubWorkflowType | ''
  tags: string[]
}>()

const emit = defineEmits<{
  'update:name': [value: string]
  'update:description': [value: string]
  'update:workflowType': [value: ComfyHubWorkflowType | '']
  'update:tags': [value: string[]]
}>()

const { t } = useI18n()

const workflowTypeOptions = computed(() => [
  {
    value: 'imageGeneration',
    label: t('workflowSharing.publish.workflowTypeImageGeneration')
  },
  {
    value: 'videoGeneration',
    label: t('workflowSharing.publish.workflowTypeVideoGeneration')
  },
  {
    value: 'upscaling',
    label: t('workflowSharing.publish.workflowTypeUpscaling')
  },
  {
    value: 'editing',
    label: t('workflowSharing.publish.workflowTypeEditing')
  }
])

const INITIAL_TAG_SUGGESTION_COUNT = 10

const showAllSuggestions = ref(false)

const availableSuggestions = computed(() =>
  COMFY_HUB_TAG_OPTIONS.filter((tag) => !tags.includes(tag))
)

const displayedSuggestions = computed(() =>
  showAllSuggestions.value
    ? availableSuggestions.value
    : availableSuggestions.value.slice(0, INITIAL_TAG_SUGGESTION_COUNT)
)

const hasHiddenSuggestions = computed(
  () =>
    !showAllSuggestions.value &&
    availableSuggestions.value.length > INITIAL_TAG_SUGGESTION_COUNT
)

const shouldShowSuggestionToggle = computed(
  () => showAllSuggestions.value || hasHiddenSuggestions.value
)

function addTag(tag: string) {
  emit('update:tags', [...tags, tag])
}
</script>
