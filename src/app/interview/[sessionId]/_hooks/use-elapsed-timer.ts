import { type Dispatch, useEffect } from "react"

import type { RoomAction } from "@/lib/interview-room/reducer"

/**
 * Dispatches a `TICK` to the room reducer once per second while mounted.
 * `dispatch` is stable across renders (`useReducer` guarantees), so the
 * effect only runs once and the interval lives until unmount.
 */
export function useElapsedTimer(dispatch: Dispatch<RoomAction>): void {
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "TICK" }), 1000)
    return () => clearInterval(id)
  }, [dispatch])
}
