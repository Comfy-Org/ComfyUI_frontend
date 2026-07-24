<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div
      ref="tableContainer"
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-interface-stroke/60"
    >
      <Table class="min-h-0 flex-1 px-4">
        <TableHeader class="sticky top-0 z-10 bg-base-background">
          <TableRow
            class="hover:bg-transparent [&>th]:h-14 [&>th]:border-b [&>th]:border-interface-stroke/60"
          >
            <TableHead class="w-40" :aria-sort="ariaSort('date')">
              <button :class="sortHeaderClass" @click="toggleSort('date')">
                {{ $t('workspacePanel.activity.columns.date') }}
                <i :class="sortIcon('date')" />
              </button>
            </TableHead>
            <TableHead class="w-56" :aria-sort="ariaSort('user')">
              <button :class="sortHeaderClass" @click="toggleSort('user')">
                {{ $t('workspacePanel.activity.columns.user') }}
                <i :class="sortIcon('user')" />
              </button>
            </TableHead>
            <TableHead :aria-sort="ariaSort('eventType')">
              <button :class="sortHeaderClass" @click="toggleSort('eventType')">
                {{ $t('workspacePanel.activity.columns.eventType') }}
                <i :class="sortIcon('eventType')" />
              </button>
            </TableHead>
            <TableHead class="w-32" :aria-sort="ariaSort('detail')">
              <button :class="sortHeaderClass" @click="toggleSort('detail')">
                {{ $t('workspacePanel.activity.columns.eventDetails') }}
                <i :class="sortIcon('detail')" />
              </button>
            </TableHead>
            <TableHead class="w-40" :aria-sort="ariaSort('credits')">
              <button
                :class="cn(sortHeaderClass, 'ml-auto')"
                @click="toggleSort('credits')"
              >
                <i class="icon-[lucide--coins] size-4" />
                {{ $t('workspacePanel.activity.columns.creditsUsed') }}
                <i :class="sortIcon('credits')" />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="event in pagedItems"
            :key="event.id"
            class="hover:bg-transparent [&:last-child>td]:border-b-0 [&>td]:border-b [&>td]:border-interface-stroke/20"
          >
            <TableCell class="text-sm text-muted-foreground tabular-nums">
              {{ formatDate(event.date) }}
            </TableCell>
            <TableCell>
              <HoverCard
                v-if="event.userName"
                :open-delay="150"
                :close-delay="0"
              >
                <HoverCardTrigger
                  as="div"
                  class="flex w-fit cursor-default items-center gap-3"
                >
                  <span
                    class="flex size-5 shrink-0 items-center justify-center rounded-full"
                    :style="{ backgroundColor: userBadgeColor(event.userName) }"
                  >
                    <span class="text-2xs font-bold text-base-foreground">
                      {{ event.userName.charAt(0).toUpperCase() }}
                    </span>
                  </span>
                  <span class="truncate text-sm text-base-foreground">
                    {{ event.userName }}
                  </span>
                </HoverCardTrigger>
                <HoverCardContent class="w-64" align="start">
                  <div class="flex w-full flex-col gap-2">
                    <div class="flex h-5 items-center justify-between">
                      <span class="text-sm text-muted-foreground">
                        {{
                          $t(
                            'workspacePanel.activity.hoverCard.totalCreditsUsed'
                          )
                        }}
                      </span>
                      <span class="flex items-center gap-1">
                        <i
                          class="icon-[lucide--coins] size-4 text-muted-foreground"
                        />
                        <span class="text-sm text-base-foreground tabular-nums">
                          {{
                            summaryFor(
                              event.userId
                            ).totalCredits.toLocaleString()
                          }}
                        </span>
                      </span>
                    </div>
                    <div class="flex h-5 items-center justify-between">
                      <span class="text-sm text-muted-foreground">
                        {{
                          $t('workspacePanel.activity.hoverCard.lastActivity')
                        }}
                      </span>
                      <span class="text-sm text-base-foreground">
                        {{ lastActivityLabel(event.userId) }}
                      </span>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
              <span v-else class="text-sm text-muted-foreground">—</span>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              <HoverCard
                v-if="event.partnerNode"
                :open-delay="150"
                :close-delay="0"
              >
                <HoverCardTrigger as="span" class="cursor-default">
                  {{ event.eventType }}
                </HoverCardTrigger>
                <HoverCardContent class="w-72" align="start">
                  <div class="flex h-5 items-center justify-between gap-4">
                    <span
                      class="text-sm whitespace-nowrap text-muted-foreground"
                    >
                      {{
                        $t('workspacePanel.activity.hoverCard.partnerNodeUsed')
                      }}
                    </span>
                    <span class="truncate text-sm text-base-foreground">
                      {{ event.partnerNode }}
                    </span>
                  </div>
                </HoverCardContent>
              </HoverCard>
              <template v-else>{{ event.eventType }}</template>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground tabular-nums">
              {{ event.detail || '—' }}
            </TableCell>
            <TableCell
              :class="
                cn(
                  'text-right text-sm tabular-nums',
                  event.credited ? 'text-credit' : 'text-muted-foreground'
                )
              "
            >
              {{ event.credited ? '+' : ''
              }}{{ event.credits.toLocaleString() }}
            </TableCell>
          </TableRow>
          <TableRow v-if="pagedItems.length === 0" class="hover:bg-transparent">
            <TableCell
              :colspan="5"
              class="py-6 text-center text-sm text-muted-foreground"
            >
              {{ $t('workspacePanel.activity.empty') }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div class="flex flex-col gap-3 @2xl:h-8 @2xl:flex-row @2xl:items-center">
      <div v-if="canViewTeamUsage" class="flex items-center">
        <a
          :href="fullActivityUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground no-underline transition-colors hover:text-base-foreground"
        >
          <i class="icon-[lucide--external-link] size-4" />
          {{ $t('workspacePanel.activity.fullActivity') }}
        </a>
      </div>
      <Pagination
        v-model:page="page"
        :total="total"
        :items-per-page="itemsPerPage"
        class="@2xl:ml-auto"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import HoverCard from '@/components/ui/hover-card/HoverCard.vue'
import HoverCardContent from '@/components/ui/hover-card/HoverCardContent.vue'
import HoverCardTrigger from '@/components/ui/hover-card/HoverCardTrigger.vue'
import Pagination from '@/components/ui/pagination/Pagination.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { useAutoPageSize } from '@/platform/workspace/composables/useAutoPageSize'
import { useWorkspaceActivity } from '@/platform/workspace/composables/useWorkspaceActivity'
import type {
  ActivityEvent,
  ActivitySortField
} from '@/platform/workspace/composables/useWorkspaceActivity'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { userBadgeColor } from '@/platform/workspace/utils/badgeColor'
import { formatRelativeTime } from '@/platform/workspace/utils/relativeTime'
import { cn } from '@comfyorg/tailwind-utils'

// `events` is the data seam: the tab shell mounts this with no events (empty
// state) until FE-1249 wires the per-workspace usage API and passes them in.
const { search, events = [] } = defineProps<{
  search: string
  events?: ActivityEvent[]
}>()

const { t, d } = useI18n()

const tableContainer = ref<HTMLElement | null>(null)
const { pageSize } = useAutoPageSize(tableContainer, 1)

const { workspaceRole } = useWorkspaceUI()
const { resolvedUserInfo } = useCurrentUser()
const canViewTeamUsage = computed(() => workspaceRole.value === 'owner')
const selfUserId = computed(() =>
  canViewTeamUsage.value ? null : (resolvedUserInfo.value?.id ?? '')
)

const fullActivityUrl = `${getComfyPlatformBaseUrl()}/profile/usage`

const {
  page,
  total,
  itemsPerPage,
  pagedItems,
  sortField,
  sortDirection,
  toggleSort,
  userSummaries
} = useWorkspaceActivity(
  () => search,
  pageSize,
  selfUserId,
  () => events
)

function summaryFor(userId: string | null) {
  return (
    (userId ? userSummaries.value.get(userId) : undefined) ?? {
      totalCredits: 0,
      lastActivity: new Date()
    }
  )
}

function lastActivityLabel(userId: string | null): string {
  return formatRelativeTime(summaryFor(userId).lastActivity, new Date(), {
    justNow: t('workspacePanel.members.activity.justNow'),
    minutesAgo: (n) => t('workspacePanel.members.activity.minutesAgo', { n }),
    hoursAgo: (n) => t('workspacePanel.members.activity.hoursAgo', { n }),
    daysAgo: (n) => t('workspacePanel.members.activity.daysAgo', n)
  })
}

const sortHeaderClass =
  'flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left font-[inherit] text-sm text-muted-foreground'

function sortIcon(field: ActivitySortField) {
  if (sortField.value !== field) return 'icon-[lucide--chevrons-up-down] size-3'
  return sortDirection.value === 'asc'
    ? 'icon-[lucide--chevron-up] size-3'
    : 'icon-[lucide--chevron-down] size-3'
}

function ariaSort(
  field: ActivitySortField
): 'ascending' | 'descending' | 'none' {
  if (sortField.value !== field) return 'none'
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}

function formatDate(date: Date): string {
  return d(date, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}
</script>
