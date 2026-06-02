<script setup lang="ts">
import { useEventListener, useTemplateRefsList } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'

import type { Department } from '../../data/roles'
import type { Locale } from '../../i18n/translations'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import { t } from '../../i18n/translations'
import { scrollTo } from '../../scripts/smoothScroll'
import CategoryNav from '../common/CategoryNav.vue'
import SectionLabel from '../common/SectionLabel.vue'

const { locale = 'en', departments = [] } = defineProps<{
  locale?: Locale
  departments?: readonly Department[]
}>()

const visibleDepartments = computed(() =>
  departments.filter((d) => d.roles.length > 0)
)

const categories = computed(() =>
  visibleDepartments.value.map((d) => ({ label: d.name, value: d.key }))
)

const hasRoles = computed(() => visibleDepartments.value.length > 0)

const activeCategory = ref('')

const sectionRefs = useTemplateRefsList<HTMLElement>()

let isScrolling = false
let pendingFrame = 0

const HEADER_OFFSET = -144
const ACTIVATION_OFFSET = 300

const deptElementId = (key: string) => `careers-dept-${key}`

function pickActiveSection() {
  pendingFrame = 0
  if (isScrolling) return
  const sections = sectionRefs.value as HTMLElement[]
  if (sections.length === 0) return

  let active = sections[0]
  for (const el of sections) {
    if (el.getBoundingClientRect().top - ACTIVATION_OFFSET <= 0) {
      active = el
    } else {
      break
    }
  }
  activeCategory.value = active.id.replace(/^careers-dept-/, '')
}

function scheduleUpdate() {
  if (pendingFrame !== 0) return
  pendingFrame = requestAnimationFrame(pickActiveSection)
}

onMounted(pickActiveSection)
useEventListener('scroll', scheduleUpdate, { passive: true })
useEventListener('resize', scheduleUpdate, { passive: true })

function scrollToDepartment(deptKey: string) {
  activeCategory.value = deptKey
  isScrolling = true
  const el = document.getElementById(deptElementId(deptKey))
  if (!el) {
    isScrolling = false
    return
  }
  scrollTo(el, {
    offset: HEADER_OFFSET,
    duration: 0.8,
    immediate: prefersReducedMotion(),
    onComplete: () => {
      isScrolling = false
      pickActiveSection()
    }
  })
}
</script>

<template>
  <section class="px-6 py-20 md:px-20 md:py-32" data-testid="careers-roles">
    <div class="mx-auto max-w-6xl">
      <div class="flex flex-col gap-12 lg:flex-row lg:gap-20">
        <div class="shrink-0 lg:min-w-48">
          <div
            class="bg-primary-comfy-ink sticky top-20 z-10 py-4 md:top-28 md:py-0"
          >
            <h2
              class="text-primary-comfy-canvas text-3xl font-light md:text-4xl"
            >
              {{ t('careers.roles.heading', locale) }}
            </h2>
            <CategoryNav
              v-if="hasRoles"
              :categories="categories"
              :model-value="activeCategory"
              class="mt-4"
              @update:model-value="scrollToDepartment"
            />
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <p
            v-if="!hasRoles"
            class="text-primary-warm-gray text-base md:text-lg"
            data-testid="careers-roles-empty"
          >
            {{ t('careers.roles.empty', locale) }}
          </p>

          <div
            v-for="dept in visibleDepartments"
            :id="deptElementId(dept.key)"
            :ref="sectionRefs.set"
            :key="dept.key"
            class="mb-12 scroll-mt-24 last:mb-0 md:scroll-mt-36"
          >
            <SectionLabel>
              {{ dept.name }}
            </SectionLabel>

            <a
              v-for="role in dept.roles"
              :key="role.id"
              :href="role.jobUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="border-primary-warm-gray/20 hover:border-primary-comfy-canvas group flex items-center gap-4 border-b py-5 transition-colors duration-200"
              data-testid="careers-role-link"
            >
              <div
                class="flex min-w-0 flex-1 flex-col md:flex-row md:items-baseline md:gap-x-4"
              >
                <span
                  class="text-primary-comfy-canvas text-base font-medium md:text-lg"
                >
                  {{ role.title }}
                </span>
                <div
                  class="text-primary-warm-gray mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm md:mt-0 md:contents"
                >
                  <span>{{ role.department }}</span>
                  <span class="md:hidden">{{ role.location }}</span>
                </div>
              </div>
              <span
                class="text-primary-warm-gray hidden shrink-0 text-sm md:inline"
              >
                {{ role.location }}
              </span>
              <span
                class="bg-primary-comfy-yellow/0 group-hover:bg-primary-comfy-yellow relative grid size-7 shrink-0 place-items-center rounded-sm transition-colors duration-300 ease-out"
              >
                <span
                  class="bg-primary-comfy-yellow group-hover:bg-primary-comfy-ink size-5 transition-colors duration-300 ease-out"
                  style="
                    mask: url('/icons/arrow-up-right.svg') center / contain
                      no-repeat;
                  "
                  aria-hidden="true"
                />
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
