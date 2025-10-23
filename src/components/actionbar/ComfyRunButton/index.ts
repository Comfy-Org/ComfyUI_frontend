import { defineAsyncComponent } from 'vue'

import { isCloud } from '@/platform/distribution/types'

export default isCloud && __BUILD_FLAGS__.REQUIRE_SUBSCRIPTION
  ? defineAsyncComponent(() => import('./CloudRunButtonWrapper.vue'))
  : defineAsyncComponent(() => import('./ComfyQueueButton.vue'))
