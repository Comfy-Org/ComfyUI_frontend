import { createRouter, createWebHistory } from 'vue-router'

import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'auth',
    component: () => import('./views/AuthView.vue')
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('./views/HomeView.vue')
  },
  {
    path: '/:workspaceId',
    component: () => import('./views/WorkspaceView.vue'),
    props: true,
    children: [
      {
        path: '',
        name: 'workspace-dashboard',
        component: () => import('./views/workspace/DashboardView.vue')
      },
      {
        path: 'projects',
        name: 'workspace-projects',
        component: () => import('./views/workspace/ProjectsView.vue')
      },
      {
        path: 'canvases',
        name: 'workspace-canvases',
        component: () => import('./views/workspace/CanvasesView.vue')
      },
      {
        path: 'workflows',
        name: 'workspace-workflows',
        component: () => import('./views/workspace/WorkflowsView.vue')
      },
      {
        path: 'assets',
        name: 'workspace-assets',
        component: () => import('./views/workspace/AssetsView.vue')
      },
      {
        path: 'models',
        name: 'workspace-models',
        component: () => import('./views/workspace/ModelsView.vue')
      },
      {
        path: 'settings',
        name: 'workspace-settings',
        component: () => import('./views/workspace/SettingsView.vue')
      },
      {
        path: ':projectId',
        name: 'project-detail',
        component: () => import('./views/workspace/ProjectDetailView.vue'),
        props: true
      }
    ]
  },
  {
    path: '/:workspaceId/:projectId/:canvasId',
    name: 'canvas',
    component: () => import('./views/CanvasView.vue'),
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
