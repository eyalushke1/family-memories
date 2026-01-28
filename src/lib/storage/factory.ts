import type { StorageProvider } from './types'

let instance: StorageProvider | null = null

export function getStorage(): StorageProvider {
  if (instance) return instance

  const storageType = process.env.STORAGE_TYPE ?? 'local'

  if (storageType === 'zadara') {
    const { ZadaraStorageProvider } = require('./zadara-provider')
    instance = new ZadaraStorageProvider()
  } else {
    const { LocalStorageProvider } = require('./local-provider')
    instance = new LocalStorageProvider()
  }

  return instance!
}

/** Reset singleton — use only in tests */
export function resetStorageInstance() {
  instance = null
}
