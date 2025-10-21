import {
  createRouter,
  createWebHashHistory,
  createWebHistory
} from 'vue-router'

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

// Global authentication guard
router.beforeEach(async (_to, _from, next) => {
  const authStore = useFirebaseAuthStore()

  // Wait for Firebase auth to initialize
  if (!authStore.isInitialized) {
    await new Promise<void>((resolve) => {
      const unwatch = authStore.$subscribe((_, state) => {
        if (state.isInitialized) {
          unwatch()
          resolve()
        }
      })
    })
  }

  // Check if user is authenticated (Firebase or API key)
  const authHeader = await authStore.getAuthHeader()

  if (!authHeader) {
    // User is not authenticated, show sign-in dialog
    const dialogService = useDialogService()
    const loginSuccess = await dialogService.showSignInDialog()

    if (loginSuccess) {
      // After successful login, proceed to the intended route
      next()
    } else {
      // User cancelled login, stay on current page or redirect to home
      next(false)
    }
  } else {
    // User is authenticated, proceed
    next()
  }
})

export default router
