import { createRouter, createWebHistory } from 'vue-router'
import LayoutDefault from '@/layout/LayoutDefault.vue'
import LayoutGraph from '@/layout/LayoutGraph.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: LayoutGraph,
      children: [
        {
          path: '',
          name: 'graphview',
          component: () => import('@/views/Index.vue')
        }
      ]
    },

    {
      path: '/test',
      component: () => import('@/views/Test.vue')
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
