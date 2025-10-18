import { defineAsyncComponent } from 'vue'

import { isCloud } from '@/platform/distribution/types'

export default isCloud
  ? defineAsyncComponent(() => import('./CloudRunButtonWrapper.vue'))
  : defineAsyncComponent(() => import('./ComfyQueueButton.vue'))
