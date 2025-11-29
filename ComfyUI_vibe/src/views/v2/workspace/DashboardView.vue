<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { WorkspaceCard } from '@/components/v2/workspace'

const route = useRoute()
const router = useRouter()

const workspaceId = computed(() => route.params.workspaceId as string)
const isTeam = computed(() => workspaceId.value === 'team')

const recentProjects = [
  { id: 'img-gen', name: 'Image Generation', canvasCount: 5, updatedAt: '2 hours ago' },
  { id: 'video-proc', name: 'Video Processing', canvasCount: 3, updatedAt: '1 day ago' },
  { id: 'audio-enh', name: 'Audio Enhancement', canvasCount: 2, updatedAt: '3 days ago' }
]

const recentActivity = [
  { icon: 'pi pi-plus', text: 'New canvas created in Image Generation', time: '2h ago' },
  { icon: 'pi pi-upload', text: 'Model uploaded: SDXL Lightning', time: '5h ago' },
  { icon: 'pi pi-pencil', text: 'Workflow updated: Upscale Pipeline', time: '1d ago' },
  { icon: 'pi pi-user-plus', text: 'New team member joined', time: '2d ago' }
]

const starterTemplates = [
  { id: 'txt2img', name: 'Text to Image', description: 'Generate images from text prompts', icon: 'pi pi-image', thumbnail: '/assets/card_images/workflow_01.webp' },
  { id: 'img2img', name: 'Image to Image', description: 'Transform existing images', icon: 'pi pi-images', thumbnail: '/assets/card_images/2690a78c-c210-4a52-8c37-3cb5bc4d9e71.webp' },
  { id: 'upscale', name: 'Upscale', description: '4x image upscaling workflow', icon: 'pi pi-expand', thumbnail: '/assets/card_images/bacb46ea-7e63-4f19-a253-daf41461e98f.webp' },
  { id: 'inpaint', name: 'Inpainting', description: 'Edit parts of an image', icon: 'pi pi-pencil', thumbnail: '/assets/card_images/228616f4-12ad-426d-84fb-f20e488ba7ee.webp' },
  { id: 'controlnet', name: 'ControlNet', description: 'Guided image generation', icon: 'pi pi-sliders-h', thumbnail: '/assets/card_images/683255d3-1d10-43d9-a6ff-ef142061e88a.webp' },
  { id: 'video', name: 'Video Generation', description: 'Create videos from prompts', icon: 'pi pi-video', thumbnail: '/assets/card_images/91f1f589-ddb4-4c4f-b3a7-ba30fc271987.webp' }
]
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {{ isTeam ? 'Team Dashboard' : 'Dashboard' }}
        </h1>
        <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Welcome back, {{ workspaceId }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <RouterLink
          :to="`/${workspaceId}/create`"
          class="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <i class="pi pi-bolt text-xs" />
          Linear
        </RouterLink>
        <RouterLink
          :to="`/${workspaceId}/canvas`"
          class="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <i class="pi pi-share-alt text-xs" />
          Node
        </RouterLink>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="mb-6 flex flex-wrap gap-2">
      <button
        class="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        @click="router.push(`/${workspaceId}/default/untitled`)"
      >
        <i class="pi pi-plus text-xs" />
        New Canvas
      </button>
      <button
        class="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        @click="router.push(`/${workspaceId}/projects`)"
      >
        <i class="pi pi-folder-plus text-xs" />
        New Project
      </button>
      <button
        class="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <i class="pi pi-upload text-xs" />
        Upload Model
      </button>
    </div>

    <!-- Starter Templates -->
    <div class="mb-8">
      <h2 class="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">Start from a template</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <WorkspaceCard
          v-for="template in starterTemplates"
          :key="template.id"
          :thumbnail="template.thumbnail"
          :title="template.name"
          :description="template.description"
          :icon="template.icon"
          action-label="Run"
          action-icon="pi pi-play"
          @click="router.push(`/${workspaceId}/default/${template.id}`)"
        />
      </div>
      <!-- View All Templates CTA -->
      <div class="mt-6 flex items-center gap-4 pt-2">
        <button
          class="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          @click="router.push(`/${workspaceId}/templates`)"
        >
          View Templates
          <i class="pi pi-arrow-right text-xs" />
        </button>
        <span class="text-sm text-zinc-400 dark:text-zinc-500">
          <span class="font-semibold text-zinc-600 dark:text-zinc-300">803+</span> workflows, models, nodes by Comfy & community
        </span>
        <div class="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>

    <!-- Content Grid -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <!-- Recent Projects -->
      <div class="lg:col-span-3">
        <div class="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div class="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Recent Projects</h2>
            <button
              class="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              @click="router.push(`/${workspaceId}/projects`)"
            >
              View all
            </button>
          </div>
          <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
            <button
              v-for="project in recentProjects"
              :key="project.id"
              class="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              @click="router.push(`/${workspaceId}/${project.id}`)"
            >
              <div class="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
                <i class="pi pi-folder text-sm text-zinc-500 dark:text-zinc-400" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ project.name }}</p>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">{{ project.canvasCount }} canvases</p>
              </div>
              <span class="text-xs text-zinc-400 dark:text-zinc-500">{{ project.updatedAt }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="lg:col-span-2">
        <div class="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div class="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Recent Activity</h2>
          </div>
          <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
            <div
              v-for="(activity, index) in recentActivity"
              :key="index"
              class="flex gap-3 px-5 py-3"
            >
              <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <i :class="[activity.icon, 'text-xs text-zinc-500 dark:text-zinc-400']" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="truncate text-sm text-zinc-600 dark:text-zinc-300">{{ activity.text }}</p>
                <p class="text-xs text-zinc-400 dark:text-zinc-500">{{ activity.time }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
