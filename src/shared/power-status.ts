export function readOnlineFlag(isOnline: () => boolean): boolean {
  try {
    return isOnline()
  } catch {
    return false
  }
}

export function powerSnapshot(input: {
  onBattery: boolean
  idleState: string
  isOnline: boolean
}): { onBattery: boolean; idleState: string; online: boolean } {
  return {
    onBattery: input.onBattery,
    idleState: input.idleState,
    online: input.isOnline
  }
}

export function powerChangedPayload(input: { onBattery: boolean; isOnline: boolean }): {
  onBattery: boolean
  online: boolean
} {
  return { onBattery: input.onBattery, online: input.isOnline }
}
