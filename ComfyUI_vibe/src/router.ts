import { createRouter, createWebHistory } from 'vue-router'

import type { RouteRecordRaw } from 'vue-router'

// Interface 2.0 (Experimental) Routes
const v2Routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'auth',
    component: () => import('./views/v2/AuthView.vue')
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('./views/v2/HomeView.vue')
  },
  {
    path: '/:workspaceId',
    component: () => import('./views/v2/WorkspaceView.vue'),
    props: true,
    children: [
      {
        path: '',
        name: 'workspace-dashboard',
        component: () => import('./views/v2/workspace/DashboardView.vue')
      },
      {
        path: 'projects',
        name: 'workspace-projects',
        component: () => import('./views/v2/workspace/ProjectsView.vue')
      },
      {
        path: 'canvases',
        name: 'workspace-canvases',
        component: () => import('./views/v2/workspace/CanvasesView.vue')
      },
      {
        path: 'workflows',
        name: 'workspace-workflows',
        component: () => import('./views/v2/workspace/WorkflowsView.vue')
      },
      {
        path: 'assets',
        name: 'workspace-assets',
        component: () => import('./views/v2/workspace/AssetsView.vue')
      },
      {
        path: 'models',
        name: 'workspace-models',
        component: () => import('./views/v2/workspace/ModelsView.vue')
      },
      {
        path: 'recents',
        name: 'workspace-recents',
        component: () => import('./views/v2/workspace/RecentsView.vue')
      },
      {
        path: 'templates',
        name: 'workspace-templates',
        component: () => import('./views/v2/workspace/TemplatesView.vue')
      },
      {
        path: 'library',
        name: 'workspace-library',
        component: () => import('./views/v2/workspace/LibraryView.vue')
      },
      {
        path: 'trash',
        name: 'workspace-trash',
        component: () => import('./views/v2/workspace/TrashView.vue')
      },
      {
        path: 'settings',
        name: 'workspace-settings',
        component: () => import('./views/v2/workspace/SettingsView.vue')
      },
      {
        path: ':projectId',
        name: 'project-detail',
        component: () => import('./views/v2/workspace/ProjectDetailView.vue'),
        props: true
      }
    ]
  },
  {
    path: '/:workspaceId/:projectId/:canvasId',
    name: 'canvas',
    component: () => import('./views/v2/CanvasView.vue'),
    props: true
  },
  {
    path: '/create',
    name: 'linear-create',
    component: () => import('./views/linear/LinearView.vue')
  },
  {
    path: '/:workspaceId/create',
    name: 'workspace-linear-create',
    component: () => import('./views/linear/LinearView.vue'),
    props: true
  }
]

// Interface 1.0 (Legacy) Routes - TODO: Add when v1 views are created
// const v1Routes: RouteRecordRaw[] = []

// Currently using v2 routes
const routes: RouteRecordRaw[] = v2Routes

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
