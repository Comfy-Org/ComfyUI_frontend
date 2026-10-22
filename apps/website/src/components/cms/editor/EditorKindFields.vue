<script setup lang="ts">
import {
  editorInputClass as inputClass,
  useEditorFields
} from '@/lib/cms/editor-fields'
import type { ContentType, Document } from '@/lib/cms/editor-document'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { kind, locale } = defineProps<{ kind: ContentType; locale: Locale }>()
const document = defineModel<Document>({ required: true })
const emit = defineEmits<{ edited: [] }>()
const t = translationsFor(locale).t
const { value, patch, list, listValue } = useEditorFields(document, () =>
  emit('edited')
)
</script>
<template>
  <template v-if="kind === 'workflow'">
    <label class="grid gap-1 text-sm text-admin-muted"
      >{{ t('cccMetadata.cloud') }}
      <select
        :value="
          typeof document.works_on_cloud === 'boolean'
            ? String(document.works_on_cloud)
            : ''
        "
        :class="inputClass"
        @change="patch('works_on_cloud', $event)"
      >
        <option value="">{{ t('cccMetadata.unspecified') }}</option>
        <option value="true">{{ t('cccWorkflow.yes') }}</option>
        <option value="false">{{ t('cccWorkflow.no') }}</option>
      </select>
    </label>
    <label class="grid gap-1 text-sm text-admin-muted"
      >{{ t('cccMetadata.outputType') }}
      <select
        :value="value('output_type')"
        :class="inputClass"
        @change="patch('output_type', $event)"
      >
        <option value="">{{ t('cccMetadata.unspecified') }}</option>
        <option
          v-for="output in [
            'image',
            'video',
            'audio',
            '3d',
            'text',
            'mixed'
          ] as const"
          :key="output"
          :value="output"
        >
          {{ t(`cccWorkflow.output.${output}`) }}
        </option>
      </select>
    </label>
    <label class="grid gap-1 text-sm text-admin-muted"
      >{{ t('cccMetadata.models')
      }}<input
        :value="listValue('model_uids')"
        :class="inputClass"
        @input="list('model_uids', $event)"
    /></label>
    <label class="grid gap-1 text-sm text-admin-muted"
      >{{ t('cccMetadata.cloudShare')
      }}<input
        :value="value('cloud_share_url')"
        :class="inputClass"
        maxlength="2000"
        @input="patch('cloud_share_url', $event)"
    /></label>
  </template>
  <template v-if="kind === 'model'"
    ><label class="grid gap-1 text-sm text-admin-muted"
      >{{ t('cmsEditor.provider')
      }}<input
        :value="value('provider')"
        :class="inputClass"
        @input="patch('provider', $event)" /></label
    ><label class="grid gap-1 text-sm text-admin-muted"
      >{{ t('cmsEditor.routerModel')
      }}<input
        :value="value('router_model_id')"
        :class="inputClass"
        @input="patch('router_model_id', $event)" /></label
  ></template>
  <template v-if="kind === 'app'"
    ><label class="grid gap-1 text-sm text-admin-muted"
      >{{ t('cmsEditor.implementation')
      }}<input
        :value="value('implementation_ref')"
        :class="inputClass"
        @input="patch('implementation_ref', $event)" /></label
    ><label class="grid gap-1 text-sm text-admin-muted"
      >{{ t('cmsEditor.workflowUID')
      }}<input
        :value="value('workflow_uid')"
        :class="inputClass"
        @input="patch('workflow_uid', $event)" /></label
  ></template>
</template>
