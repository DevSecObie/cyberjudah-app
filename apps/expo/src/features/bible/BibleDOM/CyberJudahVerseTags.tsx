import Feather from '@expo/vector-icons/Feather'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { styled } from 'goober'
import { RootState } from '~redux/modules/reducer'
import type { RootStyles } from './BibleDOMWrapper'
import { OPEN_VERSE_TAG } from './dispatch'
import { useDispatch } from './DispatchProvider'
import { InlineItemContainer, InlineItemIconWrapper } from './InlineItem'
import { scaleFontSize } from './scaleFontSize'
import { noSelect } from './utils'

export type CyberJudahVerseTag = { key: string; label: string; kind: 'precept' | 'law'; at: string }

const Tag = styled('span')<RootStyles>(
  ({ settings: { theme, colors, fontSizeScale, fontFamily } }) => ({
    fontFamily,
    padding: '0px 4px',
    borderRadius: '4px',
    color: colors[theme].default,
    backgroundColor: colors[theme].lightGrey,
    fontSize: scaleFontSize(16, fontSizeScale),
    marginRight: '5px',
    cursor: 'pointer',
    ...noSelect,
    '&:active': {
      opacity: 0.5,
    },
  })
)

/**
 * CyberJudah's precept and law tags on a verse, drawn as Bible Strong draws a verse's own tags
 * (one group each, with its icon), read-only: a tag opens its precept or its law.
 */
export default function CyberJudahVerseTags({
  tags,
  settings,
  isDisabled,
}: {
  tags: CyberJudahVerseTag[]
  settings: RootState['user']['bible']['settings']
  isDisabled?: boolean
}) {
  const dispatch = useDispatch()
  const { colors, theme } = settings
  const groups = [
    { kind: 'precept' as const, icon: 'layers' as const, color: colors[theme].primary },
    { kind: 'law' as const, icon: 'book' as const, color: colors[theme].quart },
  ]
  return (
    <>
      {groups.map(group => {
        const items = tags.filter(tag => tag.kind === group.kind)
        if (!items.length) return null
        return (
          <InlineItemContainer key={group.kind} settings={settings} isDisabled={isDisabled}>
            <InlineItemIconWrapper settings={settings}>
              {group.kind === 'law' ? (
                // The scales of the law.
                <MaterialCommunityIcons
                  name="scale-balance"
                  size={Number(scaleFontSize(15, settings.fontSizeScale).replace('px', ''))}
                  color={group.color}
                />
              ) : (
                <Feather
                  name={group.icon}
                  size={Number(scaleFontSize(14, settings.fontSizeScale).replace('px', ''))}
                  color={group.color}
                />
              )}
            </InlineItemIconWrapper>
            {items.map(tag => (
              <Tag
                key={tag.key}
                settings={settings}
                role={isDisabled ? undefined : 'link'}
                onClick={(event: React.MouseEvent) => {
                  event.stopPropagation()
                  dispatch({ type: OPEN_VERSE_TAG, payload: { key: tag.key, at: tag.at } })
                }}
              >
                {tag.label}
              </Tag>
            ))}
          </InlineItemContainer>
        )
      })}
    </>
  )
}
