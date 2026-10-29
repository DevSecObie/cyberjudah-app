import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import AnnotateTab from '../components/AnnotateTab'

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('../components/ActionsLayout', () => ({ __esModule: true, default: 'ActionsLayout' }))
jest.mock('../components/ActionItem', () => ({ __esModule: true, default: 'ActionItem' }))
jest.mock('../components/VerseTagsAction', () => ({ __esModule: true, default: 'VerseTagsAction' }))
jest.mock('../components/VerseBookmarkAction', () => ({
  __esModule: true,
  default: 'VerseBookmarkAction',
}))
jest.mock('~features/studies/AddToStudyAction', () => ({
  __esModule: true,
  default: 'AddToStudyAction',
}))

describe('released native verse annotation controls', () => {
  let renderer: ReactTestRenderer
  beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))
  afterEach(() => act(() => renderer?.unmount()))

  it('opens Free mode from the verse toolbar and keeps Focus as a separate action', () => {
    const enterFreeMode = jest.fn()
    const focus = jest.fn()
    const noOp = () => undefined
    act(() => {
      renderer = create(
        <AnnotateTab
          selectedVerses={{ '1-1-8': true }}
          version="KJV"
          screenWidth={390}
          onCreateNoteClick={noOp}
          addTag={noOp}
          onCreateLinkClick={noOp}
          onCreateStudyRelationClick={noOp}
          onAddBookmark={noOp}
          onAddToStudy={noOp}
          onPinVerses={focus}
          onEnterAnnotationMode={enterFreeMode}
          moreThanOneVerseSelected={false}
          activeStates={{ hasBookmark: false, hasFocus: false }}
        />
      )
    })
    const controls = renderer.root.findAll(item => String(item.type) === 'ActionItem')
    const freeMode = controls.find(item => item.props.label === 'Mode libre')
    expect(freeMode).toBeDefined()
    act(() => freeMode!.props.onPress())
    expect(enterFreeMode).toHaveBeenCalledTimes(1)
    expect(focus).not.toHaveBeenCalled()
    act(() => controls.find(item => item.props.label === 'Focus')!.props.onPress())
    expect(focus).toHaveBeenCalledTimes(1)
  })
})
