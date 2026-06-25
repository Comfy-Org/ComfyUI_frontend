import type { InjectionKey, Ref } from 'vue'
import { computed, inject, onBeforeUnmount, provide, ref } from 'vue'

const menuIconRegistryKey: InjectionKey<Ref<number>> =
  Symbol('menuIconRegistry')

export function provideMenuIconRegistry() {
  const count = ref(0)
  provide(menuIconRegistryKey, count)
}

export function useReserveLeading(hasOwnIcon: () => boolean) {
  const registry = inject(menuIconRegistryKey, null)
  if (registry && hasOwnIcon()) {
    registry.value++
    onBeforeUnmount(() => {
      registry.value--
    })
  }
  return computed(() => hasOwnIcon() || (registry?.value ?? 0) > 0)
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
  if (registry && checkable()) {
    registry.value++
    onBeforeUnmount(() => {
      registry.value--
    })
  }
}

export function useMenuHasCheckables() {
  const registry = inject(menuCheckRegistryKey, null)
  return computed(() => (registry?.value ?? 0) > 0)
}
