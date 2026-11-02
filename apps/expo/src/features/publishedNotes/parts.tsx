import type { ReactNode } from 'react'
import Box, { TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import ClassVideoEmbed from '~features/passageMediaLibrary/ClassVideoEmbed'
import { verseText, type Moment, type ScriptureRef } from './classTeaching'

/** A titled block of a page, under a rule (as the case studies have them). */
export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <VStack className="mt-[26px] pt-[22px] border-t-[1px] border-border gap-[12px]">
    <Text className="text-primary text-[13px] font-bold">{title}</Text>
    {children}
  </VStack>
)

/** A row that opens something: a small line above, the title, and a chevron. */
export const LinkRow = ({
  title,
  meta,
  sub,
  onPress,
}: {
  title: string
  meta?: string
  sub?: string
  onPress: () => void
}) => (
  <TouchableBox
    accessibilityRole="link"
    onPress={onPress}
    className="flex-row items-center gap-[10px] py-[11px] border-b-[1px] border-border"
  >
    <VStack className="flex-[1] gap-[2px]">
      {!!meta && <Text className="text-primary text-[12px] font-bold">{meta}</Text>}
      <Text className="text-[15px]">{title}</Text>
      {!!sub && (
        <Text className="text-grey text-[13px]" numberOfLines={2}>
          {sub}
        </Text>
      )}
    </VStack>
    <FeatherIcon name="chevron-right" size={18} color="tertiary" />
  </TouchableBox>
)

/** A scripture: its reference opens it in the Bible, its words quoted under it. */
export const Scripture = ({
  scripture,
  onOpen,
}: {
  scripture: ScriptureRef
  onOpen: (url: string) => void
}) => {
  const words = verseText(scripture)
  return (
    <TouchableBox
      accessibilityRole="link"
      onPress={() => onOpen(scripture.url)}
      className="rounded-[10px] px-[12px] py-[10px] gap-[6px]"
      style={{ backgroundColor: 'rgba(89, 131, 240, 0.08)' }}
    >
      <Text className="text-[15px] font-bold">
        {scripture.label} <Text className="text-[12px] text-grey font-bold">KJV</Text>
      </Text>
      {!!words && <Text className="text-[15px] leading-[22px] italic">“{words}”</Text>}
    </TouchableBox>
  )
}

/**
 * A moment of a class, embedded: its video plays here from the moment, and its name under it
 * opens the class.
 */
export const MomentLink = ({
  moment,
  label,
  onOpen,
}: {
  moment: Moment
  label?: string
  onOpen: (moment: Moment) => void
}) => (
  <Box className="pt-[4px]">
    <ClassVideoEmbed
      videoId={moment.video}
      start={moment.t}
      title={moment.title ?? label ?? 'Class'}
      meta={[
        moment.read ? 'Read in class' : moment.teacher,
        moment.date,
        moment.ts ? `from ${moment.ts}` : '',
      ]
        .filter(Boolean)
        .join(' · ')}
      onOpenClass={() => onOpen(moment)}
    />
  </Box>
)

/** What the classes said, quoted, with the moment it was said. */
export const Teaching = ({
  moment,
  label,
  onOpen,
}: {
  moment: Moment
  label?: string
  onOpen: (moment: Moment) => void
}) => (
  <Box className="border-l-[3px] border-border pl-[12px] gap-[4px]">
    {!!moment.text && <Text className="text-[15px] leading-[22px]">{moment.text}</Text>}
    <MomentLink moment={moment} label={label} onOpen={onOpen} />
  </Box>
)
