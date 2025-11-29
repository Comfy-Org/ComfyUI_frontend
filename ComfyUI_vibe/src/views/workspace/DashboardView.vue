<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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
  { id: 'txt2img', name: 'Text to Image', description: 'Generate images from text prompts', icon: 'pi pi-image', gradient: 'from-violet-500 to-purple-600' },
  { id: 'img2img', name: 'Image to Image', description: 'Transform existing images', icon: 'pi pi-images', gradient: 'from-blue-500 to-cyan-500' },
  { id: 'upscale', name: 'Upscale', description: '4x image upscaling workflow', icon: 'pi pi-expand', gradient: 'from-emerald-500 to-teal-600' },
  { id: 'inpaint', name: 'Inpainting', description: 'Edit parts of an image', icon: 'pi pi-pencil', gradient: 'from-orange-500 to-amber-500' },
  { id: 'controlnet', name: 'ControlNet', description: 'Guided image generation', icon: 'pi pi-sliders-h', gradient: 'from-pink-500 to-rose-600' },
  { id: 'video', name: 'Video Generation', description: 'Create videos from prompts', icon: 'pi pi-video', gradient: 'from-indigo-500 to-blue-600' }
]
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {{ isTeam ? 'Team Dashboard' : 'Dashboard' }}
      </h1>
      <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Welcome back, {{ workspaceId }}
      </p>
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
        <button
          v-for="template in starterTemplates"
          :key="template.id"
          class="group overflow-hidden rounded-lg border border-zinc-200 bg-white text-left transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          @click="router.push(`/${workspaceId}/default/${template.id}`)"
        >
          <div
            :class="[
              'flex aspect-square items-center justify-center bg-gradient-to-br',
              template.gradient
            ]"
          >
            <i :class="[template.icon, 'text-3xl text-white/90']" />
          </div>
          <div class="flex items-end justify-between gap-2 p-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ template.name }}</p>
              <p class="mt-0.5 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">{{ template.description }}</p>
            </div>
            <span
              class="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950 dark:text-blue-400 dark:group-hover:bg-blue-600 dark:group-hover:text-white"
            >
              <i class="pi pi-play text-[10px]" />
              Run
            </span>
          </div>
        </button>
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
