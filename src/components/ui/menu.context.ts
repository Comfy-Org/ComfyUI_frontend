import type { InjectionKey, Ref } from 'vue'
import { computed, inject, onBeforeUnmount, provide, ref, watch } from 'vue'

const menuIconRegistryKey: InjectionKey<Ref<number>> =
  Symbol('menuIconRegistry')

export function provideMenuIconRegistry() {
  const count = ref(0)
  provide(menuIconRegistryKey, count)
}

export function useReserveLeading(hasOwnIcon: () => boolean) {
  const registry = inject(menuIconRegistryKey, null)
  const source = computed(() => hasOwnIcon())
  if (registry) {
    let contributed = false
    watch(
      source,
      (has) => {
        if (has && !contributed) {
          registry.value++
          contributed = true
        } else if (!has && contributed) {
          registry.value--
          contributed = false
        }
      },
      { immediate: true }
    )
    onBeforeUnmount(() => {
      if (contributed) registry.value--
    })
  }
  return computed(() => source.value || (registry?.value ?? 0) > 0)
}

export type MenuSize = 'default' | 'lg'

const menuSizeKey: InjectionKey<Readonly<Ref<MenuSize>>> = Symbol('menuSize')

export function provideMenuSize(sizeRef: Readonly<Ref<MenuSize>>) {
  provide(menuSizeKey, sizeRef)
}

export function useMenuSize(): Readonly<Ref<MenuSize>> {
  return inject(
    menuSizeKey,
    computed(() => 'default')
  )
}

const menuCheckRegistryKey: InjectionKey<Ref<number>> =
  Symbol('menuCheckRegistry')

export function provideMenuCheckRegistry() {
  const count = ref(0)
  provide(menuCheckRegistryKey, count)
}

export function useRegisterCheckable(checkable: () => boolean) {
  const registry = inject(menuCheckRegistryKey, null)
  if (!registry) return
  const source = computed(() => checkable())
  let contributed = false
  watch(
    source,
    (active) => {
      if (active && !contributed) {
        registry.value++
        contributed = true
      } else if (!active && contributed) {
        registry.value--
        contributed = false
      }
    },
    { immediate: true }
  )
  onBeforeUnmount(() => {
    if (contributed) registry.value--
  })
}

export function useMenuHasCheckables() {
  const registry = inject(menuCheckRegistryKey, null)
  return computed(() => (registry?.value ?? 0) > 0)
}
