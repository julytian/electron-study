import { safeStorage } from 'electron'
import type { SafeStorageLike } from './notes'

export function createSafeStorage(): SafeStorageLike {
  return {
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    encryptString: (plain) => safeStorage.encryptString(plain),
    decryptString: (blob) => safeStorage.decryptString(blob)
  }
}
