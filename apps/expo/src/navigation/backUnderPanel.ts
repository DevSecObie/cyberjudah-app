type NavRoute = { key: string; name: string; state?: { key?: string } }
type NavState = {
  key: string
  index?: number
  routeNames?: string[]
  routes: NavRoute[]
}
type Nav = {
  getState: () => NavState | undefined
  getParent: () => Nav | undefined
  dispatch: (
    action:
      | { type: 'POP'; payload: { count: number }; source: string; target: string }
      | { type: 'RESET'; payload: object; target: string }
  ) => void
}

/**
 * On the web a side panel (a class, a Strong's entry, commentary) is a route stacked above the page
 * it sits beside. A plain back pops whatever is on top, so the page's back arrow closed the panel.
 * This finds the page's own place in the stack and, when a route sits above it, removes only the
 * page, so the panel stays open beside whatever the page goes back to (each side works on its own).
 * It returns that step to run, or undefined when nothing sits above the page or the page has
 * nothing to go back to; the caller then goes back as before.
 */
export function backUnderPanel(
  navigation: Nav | undefined,
  routeKey: string | undefined
): (() => void) | undefined {
  // The page's place at each level, from its own stack up to the root.
  const levels: { nav: Nav; key: string; state: NavState; at: number; above: boolean }[] = []
  let nav = navigation
  let key = routeKey
  while (nav && key) {
    const state = nav.getState()
    if (!state) break
    const at = state.routes.findIndex(route => route.key === key)
    if (at < 0) return undefined
    levels.push({ nav, key, state, at, above: at < state.routes.length - 1 })
    const parent = nav.getParent()
    key = parent?.getState()?.routes.find(route => route.state?.key === state.key)?.key
    nav = parent
  }
  // Nothing is stacked over the page: the usual back already does the right thing.
  if (!levels.some(level => level.above)) return undefined
  // The nearest level where the page has something behind it; first in its stack means the
  // whole stack goes back one level up.
  const level = levels.find(candidate => candidate.at > 0)
  if (level) {
    const { nav: target, key: source, state } = level
    return () => target.dispatch({ type: 'POP', payload: { count: 1 }, source, target: state.key })
  }
  // Opened straight from a link, the page has nothing behind it: it goes home, as its back arrow
  // does without a panel, and the panel stays open beside the reader.
  const home = levels.find(
    candidate => candidate.above && candidate.state.routeNames?.includes('index')
  )
  if (!home) return undefined
  const { nav: target, state, at } = home
  const routes = [{ name: 'index' }, ...state.routes.slice(at + 1)]
  return () =>
    target.dispatch({
      type: 'RESET',
      payload: { ...state, routes, index: routes.length - 1 },
      target: state.key,
    })
}
