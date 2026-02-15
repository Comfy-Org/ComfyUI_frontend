<template>
  <WorkflowDetailView
    v-if="selectedWorkflow"
    :workflow="selectedWorkflow"
    @back="selectedWorkflow = null"
    @author-selected="handleAuthorSelected"
    @run-workflow="handleRunWorkflow"
    @make-copy="handleMakeCopy"
  />
  <AuthorProfileView
    v-else
    :author-name="profile.name"
    :author-avatar-url="profile.avatarUrl"
    :stats="profile.stats"
    @back="handleBack"
    @select-workflow="handleAuthorWorkflowSelect"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AuthorProfileView from '@/components/discover/AuthorProfileView.vue'
import WorkflowDetailView from '@/components/discover/WorkflowDetailView.vue'
import type { AlgoliaWorkflowTemplate } from '@/types/discoverTypes'
import {
  authorNameToSlug,
  authorSlugToProfile
} from '@/utils/authorProfileUtil'

const route = useRoute()
const router = useRouter()
const selectedWorkflow = ref<AlgoliaWorkflowTemplate | null>(null)

const profile = computed(() =>
  authorSlugToProfile(String(route.params.slug ?? ''))
)

const handleAuthorWorkflowSelect = (template: AlgoliaWorkflowTemplate) => {
  selectedWorkflow.value = template
}

const handleBack = () => {
  void router.push({ name: 'GraphView' })
}

const handleAuthorSelected = (author: { name: string; avatarUrl?: string }) => {
  const slug = authorNameToSlug(author.name)
  void router.push({ name: 'AuthorProfileView', params: { slug } })
}

const handleRunWorkflow = (_workflow: AlgoliaWorkflowTemplate) => {
  // TODO: Implement workflow run
}

const handleMakeCopy = (_workflow: AlgoliaWorkflowTemplate) => {
  // TODO: Implement make a copy
}

watch(
  () => route.params.slug,
  () => {
    selectedWorkflow.value = null
  }
)
</script>
