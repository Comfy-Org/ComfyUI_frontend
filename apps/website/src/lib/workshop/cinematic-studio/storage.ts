interface StorageConfig {
  database: string
  store: string
  label: string
  namespaceLabel: string
}

export function accessStudioStorage<T>(
  config: StorageConfig,
  namespace: string,
  mode: IDBTransactionMode,
  action: (
    store: IDBObjectStore,
    done: (value: T) => void,
    fail: (error: unknown) => void
  ) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!namespace.trim() || namespace.length > 500) {
      reject(new Error(`Missing ${config.namespaceLabel} namespace`))
      return
    }
    let database: IDBDatabase | undefined
    let transaction: IDBTransaction | undefined
    let result: T
    let settled = false
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      database?.close()
      if (error) reject(error)
      else resolve(result)
    }
    const fail = (error: unknown) => {
      try {
        transaction?.abort()
      } catch {
        finish(error)
        return
      }
      finish(error)
    }
    const timeout = setTimeout(
      () =>
        fail(
          new DOMException(`${config.label} storage timed out`, 'TimeoutError')
        ),
      10000
    )
    try {
      const opening = indexedDB.open(config.database, 1)
      opening.onupgradeneeded = () =>
        opening.result
          .createObjectStore(config.store)
          .createIndex('namespace', 'namespace')
      opening.onerror = () =>
        finish(opening.error ?? new Error(`${config.label} storage failed`))
      opening.onblocked = () =>
        finish(new Error(`${config.label} storage blocked`))
      opening.onsuccess = () => {
        database = opening.result
        if (settled) {
          database.close()
          return
        }
        database.onversionchange = () => database?.close()
        try {
          transaction = database.transaction(config.store, mode)
          transaction.oncomplete = () => finish()
          transaction.onabort = () =>
            finish(
              transaction?.error ?? new Error(`${config.label} storage aborted`)
            )
          transaction.onerror = () =>
            finish(
              transaction?.error ?? new Error(`${config.label} storage failed`)
            )
          action(
            transaction.objectStore(config.store),
            (value) => {
              result = value
            },
            fail
          )
        } catch (error) {
          fail(error)
        }
      }
    } catch (error) {
      finish(error)
    }
  })
}
