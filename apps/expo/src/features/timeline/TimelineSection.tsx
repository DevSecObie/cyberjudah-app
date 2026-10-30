import { type SheetRef } from '~common/sheet'
import React from 'react'
import { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import Box from '~common/ui/Box'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import useTimelineLanguage from './useTimelineLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import CurrentSectionImage from './CurrentSectionImage'
import CurrentYear from './CurrentYear'
import Datebar from './Datebar'
import Line from './Line'
import NextSectionImage from './NextSectionImage'
import PrevSectionImage from './PrevSectionImage'
import ScrollView from './ScrollView'
import SectionDetailsModal from './SectionDetailsModal'
import TimelineEvent from './TimelineEvent'
import TimelineHeader from './TimelineHeader'
import { buildPublicTimelineIndexPath } from './publicTimelineRoutes'
import { getPublicSiteUrl } from '~helpers/publicSiteLinks'
import { useTimeline } from './timeline.hooks'
import { ShallowTimelineSection, TimelineSection as TimelineSectionProps } from './types'
import { useTimelineDetails } from './TimelineResourceBoundary'
import { offset, rowToPx } from './constants'
import { getTimelineFocusEvent } from './timelineViewport'
interface Props extends TimelineSectionProps {
  onPrev: () => void
  onNext: () => void
  onBackPress?: () => void
  hasBackButton?: boolean
  isFormSheet?: boolean
  isCurrent: boolean
  isFirst?: boolean
  isLast?: boolean
  entrance: 0 | 1
  prevEvent: ShallowTimelineSection
  nextEvent: ShallowTimelineSection
  sectionIndex?: number
}

const Timeline = ({
  events,
  startYear,
  endYear,
  interval,
  id,
  image,
  description,
  descriptionEn,
  title,
  titleEn,
  sectionTitle,
  sectionTitleEn,
  subTitle,
  subTitleEn,
  color,
  onPrev,
  onNext,
  onBackPress,
  hasBackButton,
  isFormSheet = false,
  isCurrent,
  isFirst,
  isLast,
  entrance,
  prevEvent,
  nextEvent,
  sectionIndex,
}: Props) => {
  const isReady = useSharedValue(0)
  const modalRef = React.useRef<SheetRef>(null)
  const openInNewTab = useOpenInNewTab()
  const pushRouteOnce = usePushRouteOnce()
  const lang = useTimelineLanguage()
  const insets = useSafeAreaInsets()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const responsive = useMediaQueriesArray()

  const timeline = useTimelineDetails()
  const eventDetailSlugs = new Set(timeline.map(e => e.slug))

  const onTimelineDetailsOpen = () => {
    modalRef.current?.present()
  }

  const openSectionInNewTab = () => {
    openInNewTab({
      id: `timeline-${generateUUID()}`,
      title: getLegacyLocalizedField(lang, { fr: title, en: titleEn }),
      isRemovable: true,
      type: 'timeline',
      data: {
        sectionIndex,
      },
    })
  }

  const { x, y, lineX, year, width, height, yearsToPx, calculateEventWidth } = useTimeline({
    startYear,
    endYear,
    interval,
  })
  const initialEvent = getTimelineFocusEvent(events, startYear, endYear, entrance)

  if (!isCurrent) {
    return null
  }

  return (
    <Box className="overflow-hidden border-continuous flex-[1] absolute left-[0px] bottom-[0px] right-[0px] top-[0px]">
      <TimelineHeader
        hasBackButton={hasBackButton}
        isFormSheet={isFormSheet}
        title={title}
        titleEn={titleEn}
        onPress={onTimelineDetailsOpen}
        details={
          <SectionDetailsModal
            inline
            modalRef={modalRef}
            {...{
              id,
              image,
              color,
              description,
              descriptionEn,
              title,
              titleEn,
              sectionTitle,
              sectionTitleEn,
              subTitle,
              subTitleEn,
              startYear,
              endYear,
              interval,
            }}
          />
        }
        onBackPress={onBackPress}
        onOpenInNewTab={openSectionInNewTab}
        onSearchPress={() => pushRouteOnce({ pathname: '/timeline-search' })}
        share={{
          // The site draws the whole timeline on one page: a period has no page of its own.
          url: getPublicSiteUrl(() => buildPublicTimelineIndexPath(lang)),
          title: getLegacyLocalizedField(lang, { fr: title, en: titleEn }),
          text: () =>
            [
              getLegacyLocalizedField(lang, { fr: title, en: titleEn }),
              getLegacyLocalizedField(lang, { fr: description, en: descriptionEn }),
            ]
              .filter(Boolean)
              .join('\n\n'),
        }}
      />

      {!isFirst && <PrevSectionImage x={x} prevEvent={prevEvent} />}
      {!isLast && <NextSectionImage x={x} width={width} nextEvent={nextEvent} />}
      <CurrentSectionImage
        isReady={isReady}
        currentEvent={{
          id,
          image,
          color,
          description,
          descriptionEn,
          title,
          titleEn,
          sectionTitle,
          sectionTitleEn,
          subTitle,
          subTitleEn,
          startYear,
          endYear,
          interval,
        }}
      />
      <ScrollView
        x={x}
        y={y}
        width={width}
        height={height}
        onPrev={onPrev}
        onNext={onNext}
        isFirst={isFirst}
        isLast={isLast}
        isReady={isReady}
        entrance={entrance}
        initialFocus={
          initialEvent && {
            x: yearsToPx(initialEvent.start) + offset,
            y: rowToPx(initialEvent.row),
          }
        }
        contentInsets={{
          top: (isFormSheet ? 0 : insets.top) + 54,
          bottom: bottomBarHeight + responsive([30, 40, 60, 60]),
        }}
      >
        <Box
          className="overflow-hidden border-continuous"
          style={{
            width: width,
            height: height,
            shadowColor: 'rgb(89,131,240)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 7,
            elevation: 1,
            overflow: 'visible',
          }}
        >
          <Box
            className="overflow-hidden border-continuous relative bg-light-grey"
            style={{ width: width, height: height }}
          >
            {events.map(event => (
              <TimelineEvent
                x={x}
                key={event.id}
                yearsToPx={yearsToPx}
                calculateEventWidth={calculateEventWidth}
                hasDetails={eventDetailSlugs ? eventDetailSlugs.has(event.slug) : true}
                sectionIndex={sectionIndex}
                {...event}
              />
            ))}
          </Box>
        </Box>
      </ScrollView>
      <Datebar
        x={x}
        width={width}
        startYear={startYear}
        endYear={endYear}
        interval={interval}
        color={color}
      />
      <Line lineX={lineX} color={color} />
      <CurrentYear
        year={year}
        x={x}
        width={width}
        lineX={lineX}
        color={color}
        onPrev={onPrev}
        onNext={onNext}
        prevColor={prevEvent?.color}
        nextColor={nextEvent?.color}
      />
      <SectionDetailsModal
        modalRef={modalRef}
        {...{
          id,
          image,
          color,
          description,
          descriptionEn,
          title,
          titleEn,
          sectionTitle,
          sectionTitleEn,
          subTitle,
          subTitleEn,
          startYear,
          endYear,
          interval,
        }}
      />
    </Box>
  )
}
export default Timeline
