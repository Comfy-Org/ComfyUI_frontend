<template>
  <PropertiesAccordionItem :label="$t('manager.actions')">
    <div class="flex flex-col gap-2 px-4">
      <CloudNodePinButton
        :revision
        :busy
        :blocked
        :saving-revision
        @pin="(id, pinned) => $emit('pin', id, pinned)"
      />
      <p
        v-if="revision.node_api_version === 1"
        class="m-0 text-xs text-muted-foreground"
      >
        {{ $t('customNodePacks.registry.conversionDeferred') }}
      </p>
    </div>
  </PropertiesAccordionItem>
  <PropertiesAccordionItem :label="$t('manager.basicInfo')">
    <ModelInfoField :label="$t('g.name')">{{ revision.name }}</ModelInfoField>
    <ModelInfoField :label="$t('customNodePacks.registry.nodeVersion')">
      {{
        revision.node_api_version
          ? $t('customNodePacks.registry.apiVersion', {
              version: revision.node_api_version
            })
          : $t('customNodePacks.registry.versionUnknown')
      }}
    </ModelInfoField>
    <ModelInfoField :label="$t('manager.version')">
      <SingleSelect
        v-model="selectedVersion"
        :options="versionOptions"
        :label="$t('customNodePacks.registry.chooseRevision')"
        size="md"
      />
    </ModelInfoField>
    <ModelInfoField :label="$t('g.status')">
      {{
        $t(
          revision.pinned
            ? 'customNodePacks.registry.pinned'
            : 'customNodePacks.registry.notPinned'
        )
      }}
      <span class="text-xs text-muted-foreground">{{
        $t(
          revision.prepared
            ? 'customNodePacks.registry.prepared'
            : 'customNodePacks.registry.pending'
        )
      }}</span>
    </ModelInfoField>
  </PropertiesAccordionItem>
  <PropertiesAccordionItem :label="$t('customNodePacks.registry.verification')">
    <div class="flex flex-col gap-2 px-4 text-xs">
      <span class="font-semibold">{{
        $t(
          revision.comfy_verified
            ? 'customNodePacks.registry.verified'
            : 'customNodePacks.registry.unverified'
        )
      }}</span>
      <template v-if="revision.verification">
        <span>{{
          $t('customNodePacks.registry.testedAt', {
            date: revision.verification.tested_at
          })
        }}</span>
        <span>{{
          $t('customNodePacks.registry.coverage', {
            count: revision.verification.tested_nodes.length,
            total: revision.nodes.length
          })
        }}</span>
        <p class="m-0 whitespace-pre-wrap">
          {{ revision.verification.scope_note }}
        </p>
        <ul class="m-0 list-none p-0">
          <li v-for="node in revision.verification.tested_nodes" :key="node">
            {{ node }}
          </li>
        </ul>
      </template>
      <p v-else class="m-0 text-muted-foreground">
        {{ $t('customNodePacks.registry.verificationMissing') }}
      </p>
    </div>
  </PropertiesAccordionItem>
  <PropertiesAccordionItem
    :label="$t('customNodePacks.registry.provenance')"
    :collapse="true"
  >
    <ModelInfoField
      v-for="field in provenanceFields"
      :key="field.label"
      :label="field.label"
    >
      <span class="text-xs break-all text-muted-foreground">{{
        field.value
      }}</span>
    </ModelInfoField>
  </PropertiesAccordionItem>
  <PropertiesAccordionItem :label="$t('g.nodes')">
    <ul class="m-0 flex list-none flex-col gap-1 px-4 text-xs">
      <li v-for="node in revision.nodes" :key="node">{{ node }}</li>
    </ul>
  </PropertiesAccordionItem>
</template>

<script setup lang="ts">
import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PropertiesAccordionItem from '@/components/rightSidePanel/layout/PropertiesAccordionItem.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import ModelInfoField from '@/platform/assets/components/modelInfo/ModelInfoField.vue'

import CloudNodePinButton from './CloudNodePinButton.vue'

const { revision, revisions, busy, blocked, savingRevision } = defineProps<{
  revision: CloudNodeRegistryRevision
  revisions: CloudNodeRegistryRevision[]
  busy: boolean
  blocked: boolean
  savingRevision?: string
}>()
const emit = defineEmits<{
  select: [revisionId: string]
  pin: [revisionId: string, pinned: boolean]
}>()
const { t } = useI18n()
const selectedVersion = computed({
  get: () => revision.revision_id,
  set: (value: string | undefined) => {
    if (value) emit('select', value)
  }
})
const versionOptions = computed(() =>
  revisions.map((item) => ({
    value: item.revision_id,
    name: t('customNodePacks.registry.revision', {
      commit:
        item.upstream_commit.slice(0, 12) ||
        t('customNodePacks.registry.provenanceMissing'),
      digest: item.revision_id.slice(0, 12)
    })
  }))
)
const provenanceFields = computed(() => [
  {
    label: t('customNodePacks.registry.upstream'),
    value:
      revision.upstream_commit ||
      t('customNodePacks.registry.provenanceMissing')
  },
  {
    label: t('customNodePacks.registry.conversion'),
    value: revision.revision_id
  },
  {
    label: t('customNodePacks.registry.sourceHash'),
    value: revision.source_sha256
  },
  {
    label: t('customNodePacks.registry.manifestHash'),
    value: revision.manifest_sha256
  },
  {
    label: t('customNodePacks.registry.dependencyHash'),
    value: revision.dependency_profile_sha256
  },
  ...(revision.verification
    ? [
        {
          label: t('customNodePacks.registry.workflowHash'),
          value: revision.verification.workflow_sha256
        },
        {
          label: t('customNodePacks.registry.evidenceHash'),
          value: revision.verification.evidence_sha256
        },
        {
          label: t('customNodePacks.registry.imageHash'),
          value: revision.verification.image_digest
        }
      ]
    : [])
])
</script>
