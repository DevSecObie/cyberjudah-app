import { backUnderPanel } from '../backUnderPanel'

type State = {
  key: string
  index: number
  routes: { key: string; name: string; state?: { key: string } }[]
}
type Nav = {
  getState: () => State
  getParent: () => Nav | undefined
  dispatch: jest.Mock
}
const nav = (state: State, parent?: Nav): Nav => ({
  getState: () => state,
  getParent: () => parent,
  dispatch: jest.fn(),
})

// The web workspace: [Home, (library) > Courses, (explore) > class panel].
const library: State = {
  key: 'library',
  index: 0,
  routes: [{ key: 'courses', name: 'passage-media' }],
}
const rootState = (panel: boolean): State => ({
  key: 'root',
  index: panel ? 2 : 1,
  routes: [
    { key: 'home', name: 'index' },
    { key: 'lib', name: '(library)', state: { key: 'library' } },
    ...(panel ? [{ key: 'exp', name: '(explore)', state: { key: 'explore' } }] : []),
  ],
})

it('takes only the page back and keeps the panel beside it open', () => {
  const root = nav(rootState(true))
  const step = backUnderPanel(nav(library, root), 'courses')
  expect(step).toBeDefined()
  step!()
  expect(root.dispatch).toHaveBeenCalledWith({
    type: 'POP',
    payload: { count: 1 },
    source: 'lib',
    target: 'root',
  })
})

it('pops the page inside its own stack when it has a page behind it', () => {
  const root = nav(rootState(true))
  const inner = nav(
    {
      key: 'library',
      index: 1,
      routes: [
        { key: 'studies', name: 'studies' },
        { key: 'courses', name: 'passage-media' },
      ],
    },
    root
  )
  backUnderPanel(inner, 'courses')!()
  expect(inner.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ source: 'courses', target: 'library' })
  )
  expect(root.dispatch).not.toHaveBeenCalled()
})

it('leaves an ordinary back alone when no panel is open', () => {
  const root = nav(rootState(false))
  expect(backUnderPanel(nav(library, root), 'courses')).toBeUndefined()
})

it('leaves it alone outside a screen', () => {
  expect(backUnderPanel(nav(library), undefined)).toBeUndefined()
})

it('sends a page opened from a link home and keeps the panel open', () => {
  const lone = nav({
    key: 'root',
    index: 1,
    routeNames: ['index', '(library)', '(explore)'],
    routes: [
      { key: 'lib', name: '(library)', state: { key: 'library' } },
      { key: 'exp', name: '(explore)' },
    ],
  } as never)
  backUnderPanel(nav(library, lone), 'courses')!()
  expect(lone.dispatch).toHaveBeenCalledWith({
    type: 'RESET',
    target: 'root',
    payload: expect.objectContaining({
      index: 1,
      routes: [{ name: 'index' }, { key: 'exp', name: '(explore)' }],
    }),
  })
})
