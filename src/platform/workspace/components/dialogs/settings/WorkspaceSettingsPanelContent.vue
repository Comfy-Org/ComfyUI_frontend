<template>
  <div class="@container flex size-full min-h-0 flex-col">
    <BillingStatusBanner class="mb-4" />

    <PlanCreditsPanelContent v-if="section === 'planCredits'" />
    <WorkspaceMembersPanelContent v-else-if="section === 'members'" />
    <PartnerNodeAccessPanel v-else />
  </div>
</template>

<script setup lang="ts">
import BillingStatusBanner from '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue'
import PartnerNodeAccessPanel from '@/platform/workspace/components/dialogs/settings/PartnerNodeAccessPanel.vue'
import PlanCreditsPanelContent from '@/platform/workspace/components/dialogs/settings/PlanCreditsPanelContent.vue'
import WorkspaceMembersPanelContent from '@/platform/workspace/components/dialogs/settings/WorkspaceMembersPanelContent.vue'

const { section } = defineProps<{
  section: 'planCredits' | 'members' | 'allowlist'
}>()
</script>
