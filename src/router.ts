import { createRouter, createWebHistory } from 'vue-router'
import LayoutDefault from '@/views/layouts/LayoutDefault.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: LayoutDefault,
      children: [
        {
          path: '',
          component: () => import('@/views/GraphView.vue')
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
