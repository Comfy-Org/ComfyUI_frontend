import { createRouter, createWebHistory } from 'vue-router'
import LayoutDefault from '@/views/layouts/LayoutDefault.vue'
import { isElectron } from './utils/envUtil'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: LayoutDefault,
      children: [
        {
          path: '',
          name: 'GraphView',
          component: () => import('@/views/GraphView.vue')
        },
        {
          path: 'server-start',
          name: 'ServerStartView',
          component: () => import('@/views/ServerStartView.vue'),
          beforeEnter: async (to, from, next) => {
            if (isElectron()) {
              next()
            } else {
              next('/')
            }
          }
        }
      ]
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
