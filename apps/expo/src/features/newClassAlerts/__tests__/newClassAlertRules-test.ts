import { newClassTopic, readNewClassPress } from '../newClassAlertRules'

describe('newClassTopic', () => {
  it('sends readers builds to the production topic and every other build to staging', () => {
    expect(newClassTopic('production')).toBe('new-classes')
    expect(newClassTopic('staging')).toBe('new-classes-staging')
    expect(newClassTopic('preview')).toBe('new-classes-staging')
    expect(newClassTopic(null)).toBe('new-classes-staging')
    expect(newClassTopic(undefined)).toBe('new-classes-staging')
  })
})

describe('readNewClassPress', () => {
  it('reads a new-class alert', () => {
    expect(
      readNewClassPress({ kind: 'new-class', video: 'abcDEF12_-x', title: 'A class' })
    ).toEqual({
      video: 'abcDEF12_-x',
      title: 'A class',
    })
  })

  it('drops an empty title', () => {
    expect(readNewClassPress({ kind: 'new-class', video: 'abcDEF12_-x', title: '  ' })).toEqual({
      video: 'abcDEF12_-x',
      title: undefined,
    })
  })

  it('ignores reading reminders and anything that is not a YouTube id', () => {
    expect(readNewClassPress({ kind: 'verse', owner: 'x', date: '2026-11-04' })).toBeUndefined()
    expect(readNewClassPress({ kind: 'new-class', video: '../../etc' })).toBeUndefined()
    expect(
      readNewClassPress({ kind: 'new-class', video: 'https://evil.example/x' })
    ).toBeUndefined()
    expect(readNewClassPress(undefined)).toBeUndefined()
    expect(readNewClassPress('new-class')).toBeUndefined()
  })
})
