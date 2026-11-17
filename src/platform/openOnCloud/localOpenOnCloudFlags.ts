import { readonly, ref } from 'vue'

const enabled = ref<boolean>()
const useLocalAgentEnabled = ref<boolean>()

/** Cloud's `open_on_cloud_enabled` for the signed-in local account; undefined until a signed-in read answers it. */
export const localOpenOnCloudEnabled = readonly(enabled)

/** Cloud's `open_on_cloud_use_local_agent_enabled` for the signed-in local account; undefined until a signed-in read answers it. */
export const localOpenOnCloudUseLocalAgentEnabled =
  readonly(useLocalAgentEnabled)

export function setLocalOpenOnCloudFlags(flags: {
  enabled: boolean | undefined
  useLocalAgentEnabled: boolean | undefined
}): void {
  enabled.value = flags.enabled
  useLocalAgentEnabled.value = flags.useLocalAgentEnabled
}
