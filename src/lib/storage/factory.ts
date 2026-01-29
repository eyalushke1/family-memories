import type { StorageProvider } from './types'
import { ZadaraStorageProvider } from './zadara-provider'
import { LocalStorageProvider } from './local-provider'

let instance: StorageProvider | null = null

export function getStorage(): StorageProvider {
  if (instance) return instance

  const storageType = process.env.STORAGE_TYPE ?? 'local'

  if (storageType === 'zadara') {
    instance = new ZadaraStorageProvider()
  } else {
    instance = new LocalStorageProvider()
  }

  return instance
}

/** Reset singleton — use only in tests */
export function resetStorageInstance() {
  instance = null
}
