import { TabCommandContext } from '~common/useTabCommands'
import { PrimitiveAtom } from 'jotai/vanilla'
import { selectAtom } from 'jotai/vanilla/utils'
import { useAtomValue } from 'jotai/react'
import React, { memo, Ref, Suspense, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated'
import { runOnJS } from 'react-native-worklets'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import BibleTabScreen from '~features/bible/BibleTabScreen'
import { isValidCommentaryVerse } from '~features/commentaries/commentaryTabValidation'
import {
  BibleTab,
  activeTabIdAtom,
  appSwitcherModeAtom,
  CommentaryTab,
  CommentaryResourceTab,
  CompareTab,
  DictionaryTab,
  NaveTab,
  NewTab,
  NotesTab,
  PlanTab,
  SearchTab,
  StrongTab,
  StudyTab,
  TabItem,
  TimelineTab,
} from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherContext'
import { useResponsiveWorkspace } from '../utils/useResponsiveWorkspace'
import useScrollToActiveTab from '../utils/useScrollToActiveTab'
import TabScreenWrapper from './TabScreenWrapper'
import {
  CommentariesTabScreen,
  CommentaryResourceTabScreen,
  CompareVersesTabScreen,
  DictionaryTabScreen,
  InvalidCommentaryTabScreen,
  NaveTabScreen,
  NewTabScreen,
  NotesTabScreen,
  PlanTabScreen,
  SearchTabScreen,
  StudiesTabScreen,
  StrongTabScreen,
  TimelineTabScreen,
} from './tabScreenComponents'
import { useSafeAreaFrame } from 'react-native-safe-area-context'
const renderTabComponent = (tab: TabItem, tabAtom: PrimitiveAtom<TabItem>) => {
  switch (tab.type) {
    case 'bible':
      return <BibleTabScreen bibleAtom={tabAtom as PrimitiveAtom<BibleTab>} />
    case 'compare':
      return <CompareVersesTabScreen compareAtom={tabAtom as PrimitiveAtom<CompareTab>} />
    case 'strong':
      return <StrongTabScreen strongAtom={tabAtom as PrimitiveAtom<StrongTab>} />
    case 'nave':
      return <NaveTabScreen naveAtom={tabAtom as PrimitiveAtom<NaveTab>} />
    case 'dictionary':
      return <DictionaryTabScreen dictionaryAtom={tabAtom as PrimitiveAtom<DictionaryTab>} />
    case 'commentary':
      return isValidCommentaryVerse(tab.data?.verse) ? (
        <CommentariesTabScreen commentaryAtom={tabAtom as PrimitiveAtom<CommentaryTab>} />
      ) : (
        <InvalidCommentaryTabScreen tabAtom={tabAtom} />
      )
    case 'commentary-resource':
      return (
        <CommentaryResourceTabScreen
          commentaryAtom={tabAtom as PrimitiveAtom<CommentaryResourceTab>}
        />
      )
    case 'search':
      return <SearchTabScreen searchAtom={tabAtom as PrimitiveAtom<SearchTab>} />
    case 'new':
      return <NewTabScreen newAtom={tabAtom as PrimitiveAtom<NewTab>} />
    case 'study':
      return <StudiesTabScreen studyAtom={tabAtom as PrimitiveAtom<StudyTab>} />
    case 'notes':
      return <NotesTabScreen notesAtom={tabAtom as PrimitiveAtom<NotesTab>} />
    case 'plan':
      return <PlanTabScreen planAtom={tabAtom as PrimitiveAtom<PlanTab>} />
    case 'timeline':
      return <TimelineTabScreen timelineAtom={tabAtom as PrimitiveAtom<TimelineTab>} />
  }
}

export type TabScreenProps = {
  tabAtom: PrimitiveAtom<TabItem>
  ref?: Ref<View>
}

// What this screen draws from the tab. A change inside the tab (a selected verse, a new
// chapter) is read by the tab's own screen: drawing the frame around it again is not needed.
const tabFrameKey = (tab: TabItem) =>
  [
    tab.type,
    tab.id,
    tab.title,
    tab.type === 'commentary' ? isValidCommentaryVerse(tab.data?.verse) : '',
  ].join('\n')

const isSameTabFrame = (a: TabItem, b: TabItem) =>
  a === b || (Boolean(a) && Boolean(b) && tabFrameKey(a) === tabFrameKey(b))

const TabScreen = ({ tabAtom, ref }: TabScreenProps) => {
  const tabFrameAtom = useMemo(() => selectAtom(tabAtom, tab => tab, isSameTabFrame), [tabAtom])
  const tab = useAtomValue(tabFrameAtom)
  const activeTabId = useAtomValue(activeTabIdAtom)
  const appSwitcherMode = useAtomValue(appSwitcherModeAtom)
  const { height: HEIGHT } = useSafeAreaFrame()
  const { activeTabScreen } = useAppSwitcherContext()
  const scrollToActiveTab = useScrollToActiveTab()

  const isWide = useResponsiveWorkspace()
  const tabId = tab.id
  const isAccessibilityVisible = appSwitcherMode === 'view' && activeTabId === tabId

  const tabComponent = renderTabComponent(tab, tabAtom)

  // Scroll to active tab in background when this tab becomes visible
  useAnimatedReaction(
    () => activeTabScreen.tabId.get() === tabId,
    (isActive, wasActive) => {
      if (!isWide && isActive && !wasActive) {
        runOnJS(scrollToActiveTab)()
      }
    }
  )

  const imageStyles = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: isWide ? (activeTabId === tabId ? 1 : 0) : activeTabScreen.opacity.get(),
      pointerEvents: isWide && activeTabId !== tabId ? 'none' : 'auto',
      transform: [
        {
          translateY: (isWide ? activeTabId === tabId : activeTabScreen.tabId.get() === tabId)
            ? 0
            : HEIGHT,
        },
      ],
    }
  })

  if (tabComponent) {
    return (
      <TabScreenWrapper
        style={imageStyles}
        ref={ref}
        accessibilityElementsHidden={!isAccessibilityVisible}
        importantForAccessibility={isAccessibilityVisible ? 'auto' : 'no-hide-descendants'}
      >
        <TabCommandContext.Provider value={tab.id}>
          <Suspense fallback={null}>{tabComponent}</Suspense>
        </TabCommandContext.Provider>
      </TabScreenWrapper>
    )
  }

  return (
    <TabScreenWrapper
      style={imageStyles}
      ref={ref}
      accessibilityElementsHidden={!isAccessibilityVisible}
      importantForAccessibility={isAccessibilityVisible ? 'auto' : 'no-hide-descendants'}
    >
      <Box
        className="overflow-hidden border-continuous flex-[1] bg-reverse items-center justify-center"
        style={StyleSheet.absoluteFill}
      >
        <Text>{tab.title} - need component</Text>
      </Box>
    </TabScreenWrapper>
  )
}

export default memo(TabScreen)
