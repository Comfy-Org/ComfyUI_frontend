<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Search } from '@lucide/vue'
import {
  workflows,
  workflowCategories,
  workflowMetadata,
  workflowPath
} from '../../config/workflow-catalogue'
import WorkshopBrowseTabs from './WorkshopBrowseTabs.vue'

const search = ref('')
const category = ref('All workflows')
const shelves = computed(() =>
  workflowCategories
    .map((name) => ({
      name,
      items: workflows.filter(
        (workflow) =>
          workflow.category === name &&
          (category.value === 'All workflows' || category.value === name) &&
          `${workflow.title} ${workflow.description}`
            .toLowerCase()
            .includes(search.value.trim().toLowerCase())
      )
    }))
    .filter((shelf) => shelf.items.length)
)
const featured = workflows[1]
</script>

<template>
  <div class="mx-auto max-w-10xl px-6 pt-5 pb-20 lg:px-8">
    <WorkshopBrowseTabs active="workflows" />
    <header class="mb-8">
      <p
        class="mb-4 text-sm font-medium tracking-widest text-primary-comfy-yellow uppercase"
      >
        Workflows
      </p>
      <h1 class="text-3xl font-light text-primary-comfy-canvas lg:text-5xl">
        What will you make next?
      </h1>
      <p class="mt-4 text-lg text-primary-comfy-canvas/70">
        Start with an outcome. Add your inputs. Make it yours.
      </p>
    </header>
    <a
      :href="workflowPath(featured.slug)"
      class="group relative mb-10 grid overflow-hidden rounded-3xl border border-transparency-white-t8 bg-transparency-white-t8 md:grid-cols-2"
    >
      <div class="flex flex-col justify-center p-7 lg:p-10">
        <p
          class="mb-4 text-xs font-medium tracking-widest text-primary-comfy-yellow uppercase"
        >
          A new look. The same object.
        </p>
        <h2 class="text-3xl font-light text-primary-comfy-canvas lg:text-4xl">
          Leather to fabric.<br />An idea to an image.
        </h2>
        <p class="mt-4 max-w-md text-primary-warm-gray">
          Bring a material reference and see your object in a whole new finish.
        </p>
        <span
          class="mt-7 inline-flex items-center gap-2 font-medium text-primary-comfy-yellow"
          >Try this workflow
          <ArrowRight
            class="size-4 transition-transform group-hover:translate-x-1"
        /></span>
      </div>
      <div class="grid min-h-64 grid-cols-2 gap-1 p-3">
        <figure
          v-for="(src, index) in workflowMetadata(featured).examples"
          :key="src"
          class="relative overflow-hidden rounded-xl"
        >
          <img
            :src="src"
            :alt="`Material replacement example ${index + 1}`"
            class="size-full object-cover"
          />
          <figcaption
            class="absolute bottom-3 left-3 rounded-full bg-primary-comfy-ink/80 px-3 py-1 text-xs text-primary-comfy-canvas"
          >
            Example {{ index + 1 }}
          </figcaption>
        </figure>
      </div>
    </a>
    <div class="mb-9 flex flex-wrap items-center gap-3">
      <label
        class="flex h-12 min-w-60 flex-1 items-center gap-3 rounded-xl border border-transparency-white-t20 px-4 text-primary-warm-gray"
      >
        <Search class="size-4" aria-hidden="true" />
        <input
          v-model="search"
          type="search"
          aria-label="Search workflows"
          placeholder="What do you want to make?"
          class="w-full bg-transparent outline-none"
        />
      </label>
      <label class="sr-only" for="workflow-category">Use case</label>
      <select
        id="workflow-category"
        v-model="category"
        class="h-12 rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink px-4 text-primary-comfy-canvas"
      >
        <option>All workflows</option>
        <option v-for="name in workflowCategories" :key="name">
          {{ name }}
        </option>
      </select>
    </div>
    <section
      v-for="shelf in shelves"
      :key="shelf.name"
      class="mb-12"
      :aria-label="shelf.name"
    >
      <h2 class="mb-5 text-2xl font-light text-primary-comfy-canvas">
        {{ shelf.name }}
      </h2>
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <a
          v-for="workflow in shelf.items"
          :key="workflow.slug"
          :href="workflowPath(workflow.slug)"
          class="group overflow-hidden rounded-2xl border border-transparency-white-t8 transition-colors hover:border-primary-comfy-yellow/50 focus-visible:outline-2 focus-visible:outline-primary-comfy-yellow"
        >
          <div class="aspect-3/2 overflow-hidden bg-transparency-white-t8">
            <img
              :src="workflowMetadata(workflow).thumbnail"
              :alt="workflow.title"
              loading="lazy"
              class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div class="p-5">
            <p class="mb-2 text-xs text-primary-warm-gray">
              {{ workflowMetadata(workflow).models.join(' · ') }}
            </p>
            <h3 class="text-lg font-medium text-primary-comfy-canvas">
              {{ workflow.title }}
            </h3>
            <p class="mt-2 text-sm/relaxed text-primary-warm-gray">
              {{ workflow.description }}
            </p>
            <span
              class="mt-5 inline-flex items-center gap-2 text-sm text-primary-comfy-yellow"
              >Open workflow <ArrowRight class="size-4"
            /></span>
          </div>
        </a>
      </div>
    </section>
    <p
      v-if="!shelves.length"
      role="status"
      class="py-16 text-center text-primary-warm-gray"
    >
      No workflows found. Try “lighting,” “material,” or “character.”
    </p>
  </div>
</template>
