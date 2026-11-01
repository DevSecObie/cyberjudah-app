import { useRouter } from 'expo-router'
import React from 'react'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

type LibraryEntry = {
  key: string
  title: string
  description: string
  icon: React.ComponentProps<typeof FeatherIcon>['name']
  pathname: string
}

/** CyberJudah's own content in the new tab's library, under Strong, Nave, Dictionary and Commentary. */
export const CYBERJUDAH_LIBRARY: LibraryEntry[] = [
  {
    key: 'classes',
    title: 'Classes',
    description: 'Every class, newest first',
    icon: 'play-circle',
    pathname: '/(library)/passage-media',
  },
  {
    key: 'cases',
    title: 'Case Studies',
    description: 'The cases the classes made',
    icon: 'briefcase',
    pathname: '/(library)/case-studies',
  },
  {
    key: 'precepts',
    title: 'Precepts',
    description: 'Here a little, there a little',
    icon: 'layers',
    pathname: '/(library)/precepts',
  },
  {
    key: 'law',
    title: 'The Law',
    description: 'The commandments, statutes and judgments',
    icon: 'book',
    pathname: '/(library)/law',
  },
  {
    key: 'notes',
    title: '4 Chapters',
    description: 'Four chapters a day notes',
    icon: 'file-text',
    pathname: '/(library)/study-notes',
  },
  {
    key: 'encyclopedia',
    title: 'Encyclopedia',
    description: 'People, places and nations',
    icon: 'bookmark',
    pathname: '/(library)/encyclopedia',
  },
  {
    key: 'topics',
    title: 'Topics',
    description: 'Scripture by subject',
    icon: 'tag',
    pathname: '/(library)/topics',
  },
  {
    key: 'doctrines',
    title: 'Doctrines',
    description: 'False doctrines exposed',
    icon: 'alert-triangle',
    pathname: '/(library)/false-doctrines',
  },
  {
    key: 'glossary',
    title: 'Glossary',
    description: 'Words the classes use',
    icon: 'list',
    pathname: '/(library)/glossary',
  },
]

const LibraryItem = ({ entry, compact }: { entry: LibraryEntry; compact: boolean }) => {
  const router = useRouter()
  return (
    <TouchableBox
      testID={`new-tab-cyberjudah-${entry.key}`}
      accessibilityRole="button"
      accessibilityLabel={entry.title}
      accessibilityHint={entry.description}
      activeOpacity={0.7}
      onPress={() => router.push(entry.pathname as never)}
      className={
        compact
          ? 'flex-1 overflow-hidden border-continuous flex-row items-center bg-surface rounded-[16px] px-[12px] py-[10px] min-h-[64px] gap-[10px]'
          : 'flex-1 overflow-hidden border-continuous flex-row items-center bg-surface rounded-[16px] px-[18px] py-[18px] min-h-[92px] gap-[14px]'
      }
    >
      <FeatherIcon name={entry.icon} size={compact ? 26 : 30} color="primary" />
      <Box className={compact ? 'flex-1 min-w-0 gap-[2px]' : 'flex-1 min-w-0 gap-[6px]'}>
        <Text
          className={compact ? 'text-[15px] leading-[19px] font-medium' : 'text-[16px] font-medium'}
        >
          {entry.title}
        </Text>
        <Text
          className={
            compact
              ? 'text-[12px] leading-[16px] text-tertiary'
              : 'text-[13px] leading-[19px] text-tertiary'
          }
        >
          {entry.description}
        </Text>
      </Box>
      {compact ? null : <FeatherIcon name="chevron-right" size={18} color="tertiary" />}
    </TouchableBox>
  )
}

/** Our content as rows of the library, two to a row like Strong, Nave, Dictionary and Commentary. */
export default function CyberJudahLibraryItems({
  compact,
  columns,
  gap,
}: {
  compact: boolean
  columns: boolean
  gap: number
}) {
  const rows: LibraryEntry[][] = []
  for (let i = 0; i < CYBERJUDAH_LIBRARY.length; i += columns ? 2 : 1) {
    rows.push(CYBERJUDAH_LIBRARY.slice(i, i + (columns ? 2 : 1)))
  }
  return (
    <>
      {rows.map(row => (
        <Box key={row[0].key} className="flex-row" style={{ gap }}>
          {row.map(entry => (
            <LibraryItem key={entry.key} entry={entry} compact={compact} />
          ))}
          {/* An odd last item keeps half the row, the width of every other tile. */}
          {columns && row.length === 1 ? <Box className="flex-1" /> : null}
        </Box>
      ))}
    </>
  )
}
