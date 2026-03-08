type PromotionEntry = {
  interiorNodeId: string
  widgetName: string
  viewKey?: string
}

type CreateView<TView> = (entry: PromotionEntry) => TView

/**
 * Reconciles promoted widget entries to stable view instances.
 *
 * Keeps object identity stable by key while preserving the current
 * promotion order and deduplicating duplicate entries by first occurrence.
 */
export class PromotedWidgetViewManager<TView> {
  private viewCache = new Map<string, TView>()
  private cachedViews: TView[] | null = null
  private cachedEntryKeys: string[] | null = null

  reconcile(
    entries: readonly PromotionEntry[],
    createView: CreateView<TView>
  ): TView[] {
    const entryKeys = entries.map((entry) =>
      this.makeKey(entry.interiorNodeId, entry.widgetName, entry.viewKey)
    )

    if (this.cachedViews && this.areEntryKeysEqual(entryKeys))
      return this.cachedViews

    const views: TView[] = []
    const seenKeys = new Set<string>()

    for (const entry of entries) {
      const key = this.makeKey(
        entry.interiorNodeId,
        entry.widgetName,
        entry.viewKey
      )
      if (seenKeys.has(key)) continue
      seenKeys.add(key)

      const existing = this.viewCache.get(key)
      if (existing) {
        views.push(existing)
        continue
      }

      const nextView = createView(entry)
      this.viewCache.set(key, nextView)
      views.push(nextView)
    }

    for (const key of this.viewCache.keys()) {
      if (!seenKeys.has(key)) this.viewCache.delete(key)
    }

    this.cachedViews = views
    this.cachedEntryKeys = entryKeys
    return views
  }

  getOrCreate(
    interiorNodeId: string,
    widgetName: string,
    createView: () => TView,
    viewKey?: string
  ): TView {
    const key = this.makeKey(interiorNodeId, widgetName, viewKey)
    const cached = this.viewCache.get(key)
    if (cached) return cached

    const view = createView()
    this.viewCache.set(key, view)
    return view
  }

  remove(interiorNodeId: string, widgetName: string): void {
    this.viewCache.delete(this.makeKey(interiorNodeId, widgetName))
    this.invalidateMemoizedList()
  }

  removeByViewKey(
    interiorNodeId: string,
    widgetName: string,
    viewKey: string
  ): void {
    this.viewCache.delete(this.makeKey(interiorNodeId, widgetName, viewKey))
    this.invalidateMemoizedList()
  }

  clear(): void {
    this.viewCache.clear()
    this.invalidateMemoizedList()
  }

  invalidateMemoizedList(): void {
    this.cachedViews = null
    this.cachedEntryKeys = null
  }

  private areEntryKeysEqual(entryKeys: string[]): boolean {
    if (!this.cachedEntryKeys) return false
    if (this.cachedEntryKeys.length !== entryKeys.length) return false

    for (let index = 0; index < entryKeys.length; index += 1) {
      if (this.cachedEntryKeys[index] !== entryKeys[index]) return false
    }
    return true
  }

  private makeKey(
    interiorNodeId: string,
    widgetName: string,
    viewKey?: string
  ): string {
    const baseKey = `${interiorNodeId}:${widgetName}`
    return viewKey ? `${baseKey}:${viewKey}` : baseKey
  }
}
