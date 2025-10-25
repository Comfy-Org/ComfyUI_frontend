import { until } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import {
  createRouter,
  createWebHashHistory,
  createWebHistory
} from 'vue-router'

import { isCloud } from '@/platform/distribution/types'
import { useDialogService } from '@/services/dialogService'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { useUserStore } from '@/stores/userStore'
import { isElectron } from '@/utils/envUtil'
import LayoutDefault from '@/views/layouts/LayoutDefault.vue'

const isFileProtocol = window.location.protocol === 'file:'
const basePath = isElectron() ? '/' : window.location.pathname

const router = createRouter({
  history: isFileProtocol
    ? createWebHashHistory()
    : // Base path must be specified to ensure correct relative paths
      // Example: For URL 'http://localhost:7801/ComfyBackendDirect',
      // we need this base path or assets will incorrectly resolve from 'http://localhost:7801/'
      createWebHistory(basePath),
  routes: [
    {
      path: '/',
      component: LayoutDefault,
      children: [
        {
          path: '',
          name: 'GraphView',
          component: () => import('@/views/GraphView.vue'),
          beforeEnter: async (_to, _from, next) => {
            const userStore = useUserStore()
            await userStore.initialize()
            if (userStore.needsLogin) {
              next('/user-select')
            } else {
              next()
            }
          }
        },
        {
          path: 'user-select',
          name: 'UserSelectView',
          component: () => import('@/views/UserSelectView.vue')
        }
      ]
    }
  ],

  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

if (isCloud) {
  // Global authentication guard
  router.beforeEach(async (_to, _from, next) => {
    const authStore = useFirebaseAuthStore()

    // Wait for Firebase auth to initialize
    // Timeout after 16 seconds
    if (!authStore.isInitialized) {
      try {
        const { isInitialized } = storeToRefs(authStore)
        await until(isInitialized).toBe(true, { timeout: 16_000 })
      } catch (error) {
        console.error('Auth initialization failed:', error)
        return next({ name: 'cloud-auth-timeout' })
      }
    }

    // Pass authenticated users
    const authHeader = await authStore.getAuthHeader()
    if (authHeader) {
      return next()
    }

    // Show sign-in for unauthenticated users
    const dialogService = useDialogService()
    const loginSuccess = await dialogService.showSignInDialog()

    if (loginSuccess) return next()
    return next(false)
  })
}

export default router
