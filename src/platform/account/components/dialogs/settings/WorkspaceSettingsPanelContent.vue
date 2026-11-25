<template>
  <div class="@container flex size-full min-h-0 flex-col">
    <WorkspaceHeaderMenu />
    <component :is="statusBanner" :section class="mb-4" />

    <PlanCreditsPanelContent v-if="section === 'planCredits'" />
    <WorkspaceMembersPanelContent v-else-if="section === 'members'" />
    <PartnerNodeAccessPanel v-else />
  </div>
</template>

<script setup lang="ts">
import BillingStatusBanner from '@/platform/billing/components/settings/BillingStatusBanner.vue'
import BillingStatusBannerLegacy from '@/platform/billing/legacy160/platform/billing/components/settings/BillingStatusBanner.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import PartnerNodeAccessPanel from '@/platform/workspace/components/dialogs/settings/PartnerNodeAccessPanel.vue'
import PlanCreditsPanelContent from '@/platform/account/components/dialogs/settings/PlanCreditsPanelContent.vue'
import WorkspaceHeaderMenu from '@/platform/account/components/dialogs/settings/WorkspaceHeaderMenu.vue'
import WorkspaceMembersPanelContent from '@/platform/account/components/dialogs/settings/WorkspaceMembersPanelContent.vue'
import { computed } from 'vue'

const { section } = defineProps<{
  section: 'planCredits' | 'members' | 'allowlist'
}>()

const { flags } = useFeatureFlags()
const statusBanner = computed(() =>
  flags.billingNewUxEnabled ? BillingStatusBanner : BillingStatusBannerLegacy
)
</script>
