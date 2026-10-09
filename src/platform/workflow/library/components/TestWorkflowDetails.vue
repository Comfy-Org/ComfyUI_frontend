<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type {
  CommunityWorkflowDetail,
  TestWorkflowGraphVariant
} from '../utils/cloudWorkflowAdaptation'
import { getCloudAdaptation } from '../utils/cloudWorkflowAdaptation'

const { record, busy } = defineProps<{
  record: CommunityWorkflowDetail
  busy: boolean
}>()
const emit = defineEmits<{
  open: [variant: TestWorkflowGraphVariant]
  variants: [cluster: string]
}>()
const { t } = useI18n()
const cloudAdaptation = computed(() =>
  record.community_cloud_adaptation_available
    ? getCloudAdaptation(record)
    : undefined
)
</script>

<template>
  <div class="flex flex-col gap-4 p-6 text-sm">
    <h3 class="m-0 text-base font-semibold wrap-break-word">
      {{ record.metadata.name }}
    </h3>
    <p class="m-0 wrap-break-word">{{ record.metadata.description }}</p>
    <Button :disabled="busy" @click="emit('open', 'original')">{{
      t('testWorkflowLibrary.openOriginal')
    }}</Button>
    <Button
      v-if="cloudAdaptation"
      :disabled="busy"
      variant="secondary"
      @click="emit('open', 'cloud')"
      >{{ t('community.openCloudAdapted') }}</Button
    >
    <p
      v-if="record.metadata.cloud_adaptation !== undefined"
      class="m-0 text-xs text-muted-foreground"
    >
      {{ t('community.adaptationNotice') }}
    </p>
    <p class="m-0 text-xs text-muted-foreground">
      {{ t('testWorkflowLibrary.noAutomaticActions') }}
    </p>
    <Button disabled variant="secondary">{{
      t('testWorkflowLibrary.magicPatch')
    }}</Button>
    <p class="m-0 text-xs text-muted-foreground">
      {{ t('testWorkflowLibrary.converterUnavailable') }}
    </p>
    <section>
      <h4 class="mb-2 font-semibold">
        {{ t('testWorkflowLibrary.readiness') }}
      </h4>
      <p>{{ record.metadata.readiness.status }}</p>
      <p class="text-xs text-muted-foreground">
        {{
          t(
            record.summary.verified
              ? 'testWorkflowLibrary.verified'
              : 'testWorkflowLibrary.notVerified'
          )
        }}
      </p>
      <ul class="list-inside list-disc">
        <li
          v-for="(note, index) in record.metadata.readiness.notes"
          :key="index"
        >
          {{ note }}
        </li>
        <li
          v-for="(input, index) in record.metadata.required_inputs"
          :key="`input-${index}`"
        >
          <span>{{ input.node_type }} · {{ input.availability }}</span>
          <p class="text-xs break-all text-muted-foreground">
            {{ input.location }}
          </p>
          <pre
            v-if="input.recorded_widgets !== undefined"
            class="overflow-auto text-xs whitespace-pre-wrap"
            >{{ JSON.stringify(input.recorded_widgets, null, 2) }}</pre>
        </li>
      </ul>
    </section>
    <section>
      <h4 class="mb-2 font-semibold">{{ t('testWorkflowLibrary.nodes') }}</h4>
      <ul class="list-inside list-disc wrap-break-word">
        <li v-for="type in record.metadata.node_types" :key="type">
          {{ type }}
        </li>
      </ul>
    </section>
    <section>
      <h4 class="mb-2 font-semibold">{{ t('testWorkflowLibrary.packs') }}</h4>
      <div
        v-for="(pack, index) in record.metadata.packs"
        :key="index"
        class="mb-3 wrap-break-word"
      >
        <p>{{ pack.node_type }} · {{ pack.resolution }}</p>
        <p
          v-for="(candidate, candidateIndex) in pack.candidates"
          :key="candidateIndex"
          class="text-xs text-muted-foreground"
        >
          {{ candidate.pack_id }} {{ candidate.owner }}
          {{ candidate.repository }} {{ candidate.legacy_reference }}
        </p>
      </div>
    </section>
    <section>
      <h4 class="mb-2 font-semibold">{{ t('testWorkflowLibrary.models') }}</h4>
      <p class="text-xs text-muted-foreground">
        {{ t('testWorkflowLibrary.modelReferencesOnly') }}
      </p>
      <div
        v-for="(model, index) in record.metadata.models"
        :key="index"
        class="mb-3 wrap-break-word"
      >
        <p>{{ model.kind }} · {{ model.name }}</p>
        <p class="text-xs text-muted-foreground">
          {{ model.loader }} · {{ model.location }}
        </p>
        <details v-if="model.verification !== undefined">
          <summary>{{ t('community.modelVerification') }}</summary>
          <pre class="overflow-auto text-xs whitespace-pre-wrap">{{
            JSON.stringify(model.verification, null, 2)
          }}</pre>
        </details>
      </div>
      <details v-if="record.metadata.model_verification !== undefined">
        <summary>{{ t('community.modelVerification') }}</summary>
        <pre class="overflow-auto text-xs whitespace-pre-wrap">{{
          JSON.stringify(record.metadata.model_verification, null, 2)
        }}</pre>
      </details>
    </section>
    <details v-if="record.metadata.cloud_adaptation !== undefined">
      <summary>{{ t('community.cloudAdaptation') }}</summary>
      <pre class="overflow-auto text-xs whitespace-pre-wrap">{{
        JSON.stringify(record.metadata.cloud_adaptation, null, 2)
      }}</pre>
    </details>
    <section
      v-if="record.metadata.prompts.length || record.metadata.example_prompt"
    >
      <h4 class="mb-2 font-semibold">{{ t('testWorkflowLibrary.prompts') }}</h4>
      <p
        v-if="record.metadata.example_prompt"
        class="wrap-break-word whitespace-pre-wrap"
      >
        {{ record.metadata.example_prompt }}
      </p>
      <p
        v-for="(prompt, index) in record.metadata.prompts"
        :key="index"
        class="wrap-break-word whitespace-pre-wrap"
      >
        {{ prompt.text }}
        <span class="block text-xs break-all text-muted-foreground">{{
          prompt.location
        }}</span>
      </p>
    </section>
    <section>
      <h4 class="mb-2 font-semibold">
        {{ t('testWorkflowLibrary.provenance') }}
      </h4>
      <p class="wrap-break-word">{{ record.metadata.provenance.source }}</p>
      <p class="wrap-break-word">{{ record.metadata.provenance.license }}</p>
      <pre class="overflow-auto text-xs whitespace-pre-wrap">{{
        JSON.stringify(record.metadata.provenance, null, 2)
      }}</pre>
      <p class="text-xs break-all text-muted-foreground">
        {{ record.summary.workflow_sha256 }}
      </p>
    </section>
    <details v-if="record.source_metadata_json !== undefined">
      <summary>{{ t('testWorkflowLibrary.sourceMetadata') }}</summary>
      <p class="text-xs text-muted-foreground">
        {{ t('testWorkflowLibrary.sourceMetadataNotice') }}
      </p>
      <p class="text-xs break-all text-muted-foreground">
        {{ record.source_metadata_sha256 }}
      </p>
      <pre class="max-h-80 overflow-auto text-xs whitespace-pre-wrap">{{
        record.source_metadata_json
      }}</pre>
    </details>
    <Button
      v-if="record.metadata.structural_cluster"
      variant="secondary"
      :disabled="busy"
      @click="emit('variants', record.metadata.structural_cluster)"
    >
      {{ t('testWorkflowLibrary.variants') }}
    </Button>
  </div>
</template>
