/**
 * 画面读状态层的快照（React 的 useSyncExternalStore）：状态层一变，画面就重画；没变就是同一个物件，不会多画。
 */
import { useCallback, useSyncExternalStore } from 'react'
import type { AppState } from '../app/state.ts'
import type { MainStore } from '../app/store.ts'

export function useAppState(store: MainStore): AppState {
  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubscribe = store.subscribe(listener)
      return () => {
        unsubscribe()
      }
    },
    [store],
  )
  const snapshot = useCallback(() => store.getState(), [store])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
