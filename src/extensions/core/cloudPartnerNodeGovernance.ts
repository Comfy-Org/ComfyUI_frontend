import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.Cloud.PartnerNodeGovernance',

  setup: () => {
    usePartnerNodeGovernanceStore()
  }
})
