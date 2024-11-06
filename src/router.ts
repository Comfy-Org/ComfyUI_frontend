import { createRouter, createWebHistory } from 'vue-router'
import LayoutDefault from '@/views/layouts/LayoutDefault.vue'
import ServerStartView from '@/views/ServerStartView.vue'
import { useWorkspaceStore, WorkspaceState } from '@/stores/workspaceStore'

const router = createRouter({
  history: createWebHistory(window.location.pathname),
  routes: [
    {
      path: '/server-start',
      component: ServerStartView
    },
    {
      path: '/',
      component: LayoutDefault,
      children: [
        {
          path: '',
          component: () => import('@/views/GraphView.vue')
        }
      ],
      beforeEnter: async (to, from, next) => {
        if (useWorkspaceStore().state !== WorkspaceState.Ready) {
          next('/server-start')
        } else {
          next()
        }
      }
    }
  ],

  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

export default router
