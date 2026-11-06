<template>
  <div
    class="flex max-h-[85vh] w-[calc(100vw-1rem)] flex-col rounded-2xl border bg-background shadow-lg sm:max-w-xl"
    data-testid="workspace-template-form"
  >
    <DialogHeader>
      <DialogTitle>
        {{
          mode === 'add'
            ? $t('workspaceTemplates.addDialogTitle')
            : $t('workspaceTemplates.editDialogTitle')
        }}
      </DialogTitle>
      <DialogClose :aria-label="$t('g.close')" />
    </DialogHeader>
    <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
      <div
        class="flex scrollbar-custom min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-2"
      >
        <Field>
          <FieldLabel for="workspace-template-title">
            {{ $t('workspaceTemplates.title') }}
          </FieldLabel>
          <Input
            id="workspace-template-title"
            v-model="title"
            autofocus
            :maxlength="TITLE_MAX_LENGTH"
          />
        </Field>
        <Field>
          <FieldLabel for="workspace-template-description">
            {{ $t('workspaceTemplates.description') }}
          </FieldLabel>
          <Textarea
            id="workspace-template-description"
            v-model="description"
            :placeholder="$t('workspaceTemplates.descriptionPlaceholder')"
            :maxlength="DESCRIPTION_MAX_LENGTH"
            rows="4"
          />
        </Field>
        <WorkspaceTemplateThumbnailPicker
          v-if="mode === 'add'"
          v-model:type="thumbnailType"
          v-model:url="thumbnailUrl"
          v-model:comparison-url="comparisonUrl"
        />
      </div>
      <DialogFooter>
        <Button variant="secondary" size="lg" type="button" @click="close">
          {{ $t('g.cancel') }}
        </Button>
        <Button
          variant="inverted"
          size="lg"
          type="submit"
          :disabled="!isValid || isSubmitting"
        >
          {{
            mode === 'add' ? $t('workspaceTemplates.addTemplate') : $t('g.save')
          }}
        </Button>
      </DialogFooter>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { computed, ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import DialogClose from '@comfyorg/design-system/dialog/DialogClose'
import DialogFooter from '@comfyorg/design-system/dialog/DialogFooter'
import DialogHeader from '@comfyorg/design-system/dialog/DialogHeader'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import Field from '@comfyorg/design-system/field/Field'
import FieldLabel from '@comfyorg/design-system/field/FieldLabel'
import Input from '@comfyorg/design-system/input/Input'
import Textarea from '@comfyorg/design-system/textarea/Textarea'

import { useDialogStore } from '@/stores/dialogStore'

import type {
  WorkspaceTemplateRequirements,
  WorkspaceTemplateThumbnailType
} from '@/platform/workflow/templates/workspace/workspaceTemplateTypes'
import { useWorkspaceTemplatesStore } from '@/platform/workflow/templates/workspace/workspaceTemplatesStore'
import { WORKSPACE_TEMPLATE_FORM_DIALOG_KEY } from '@/platform/workflow/templates/workspace/workspaceTemplateDialogKeys'
import WorkspaceTemplateThumbnailPicker from './WorkspaceTemplateThumbnailPicker.vue'

const TITLE_MAX_LENGTH = 120
const DESCRIPTION_MAX_LENGTH = 2000

const props = defineProps<
  | {
      mode: 'add'
      initialTitle: string
      workflow: ComfyWorkflowJSON
      requirements: WorkspaceTemplateRequirements
    }
  | {
      mode: 'edit'
      templateId: string
      initialTitle: string
      initialDescription: string
    }
>()

const dialogStore = useDialogStore()
const workspaceTemplatesStore = useWorkspaceTemplatesStore()

const title = ref(props.initialTitle)
const description = ref(props.mode === 'edit' ? props.initialDescription : '')
const thumbnailType = ref<WorkspaceTemplateThumbnailType>('image')
const thumbnailUrl = ref('')
const comparisonUrl = ref('')
const isSubmitting = ref(false)

const hasThumbnail = computed(() =>
  thumbnailType.value === 'image_comparison'
    ? Boolean(thumbnailUrl.value && comparisonUrl.value)
    : Boolean(thumbnailUrl.value)
)

const isValid = computed(
  () =>
    title.value.trim().length > 0 &&
    (props.mode === 'edit' || hasThumbnail.value)
)

function close() {
  dialogStore.closeDialog({ key: WORKSPACE_TEMPLATE_FORM_DIALOG_KEY })
}

async function submit() {
  if (!isValid.value || isSubmitting.value) return
  isSubmitting.value = true
  try {
    const saved =
      props.mode === 'add'
        ? await workspaceTemplatesStore.addTemplate({
            title: title.value,
            description: description.value,
            workflow_json: props.workflow,
            requirements: props.requirements,
            thumbnail: {
              type: thumbnailType.value,
              url: thumbnailUrl.value,
              comparisonUrl:
                thumbnailType.value === 'image_comparison'
                  ? comparisonUrl.value
                  : null
            }
          })
        : await workspaceTemplatesStore.updateTemplate(props.templateId, {
            title: title.value,
            description: description.value
          })
    if (saved) close()
  } finally {
    isSubmitting.value = false
  }
}
</script>
