import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { Fragment } from 'react'
import Box, { VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useRecordHistory } from '~features/history/useRecordHistory'
import { longDate } from '~features/notesExport/notePdf'
import { loadDoctrine, verseText, type Moment } from './classTeaching'
import { MomentLink } from './parts'
import { useOpenSiteLink } from './siteLinks'
import { ChipRow, JumpSection, ScriptureRow, StudyPage, StudyRowsCard } from './studyKit'

/** Who taught it and when, as a line that opens the class at that moment. */
const momentLine = (moment: Moment) =>
  [
    moment.read ? `Read in ${moment.title ?? 'class'}` : moment.teacher,
    moment.read ? '' : moment.title,
    longDate(moment.date),
    moment.ts ? `from ${moment.ts}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

/** What a class said about a scripture: the words, then the line to the moment. */
const Point = ({ moment, onOpen }: { moment: Moment; onOpen: (moment: Moment) => void }) => (
  <VStack className="gap-[4px]">
    {!!moment.text && !moment.read && (
      <Text className="text-[15px] leading-[22px]" numberOfLines={6}>
        {moment.text}
      </Text>
    )}
    <Text className="text-[13px] text-link" onPress={() => onOpen(moment)} numberOfLines={2}>
      {momentLine(moment)}
    </Text>
  </VStack>
)

/** A false doctrine on Bible Strong's dictionary entry page: the claim, the scripture that answers it, the teaching, the scriptures against it. */
const DoctrineScreen = () => {
  const { slug = '' } = useLocalSearchParams<{ slug?: string }>()
  const { open, openMoment } = useOpenSiteLink()
  const entry = useQuery({
    queryKey: ['cyberjudah-doctrine', slug],
    queryFn: () => loadDoctrine(slug),
    enabled: !!slug,
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const d = entry.data

  // Reopened from Pick up and History, like Bible Strong's own pages.
  useRecordHistory(
    d?.name
      ? {
          type: 'cyberjudah',
          kind: 'doctrine',
          title: d.name,
          pathname: '/(explore)/false-doctrine',
          params: { slug },
        }
      : null
  )

  const related = d
    ? [
        ...(d.related?.precepts ?? []),
        ...(d.related?.cases ?? []),
        ...(d.related?.topics ?? []),
      ].map(item => ({ key: item.url, label: item.title ?? item.name ?? item.label ?? item.slug }))
    : []

  return (
    <StudyPage
      kind="nave"
      kindLabel="False doctrine"
      headerTitle="False Doctrines"
      title={d?.name}
      isPending={entry.isPending}
      isError={entry.isError}
      errorMessage="This false doctrine did not load. Check your connection."
      jumps={
        d
          ? [
              { id: 'claim', label: 'The claim' },
              ...(d.answers.length ? [{ id: 'scripture', label: 'Scripture' }] : []),
              ...(d.scriptures?.length ? [{ id: 'against', label: 'Against it' }] : []),
              ...(d.books?.length ? [{ id: 'books', label: 'Books' }] : []),
              ...(related.length ? [{ id: 'related', label: 'Related' }] : []),
            ]
          : undefined
      }
    >
      {d && (
        <>
          <JumpSection id="claim" title="The claim">
            <Text className="text-[16px] leading-[24px] italic">{d.claim}</Text>
          </JumpSection>
          {d.answers.length > 0 && (
            <JumpSection id="scripture" title="Scripture" surface="none">
              {d.answers.map((answer, i) => (
                <VStack key={i} className="gap-[12px]">
                  <StudyRowsCard>
                    {answer.refs.map(ref => (
                      <ScriptureRow
                        key={ref.url}
                        label={ref.label}
                        text={verseText(ref)}
                        onPress={() => open(ref.url)}
                      />
                    ))}
                  </StudyRowsCard>
                  {answer.sense.map((moment, n) => (
                    <Fragment key={n}>
                      {!!moment.text && (
                        <Box className="rounded-[12px] bg-surface p-[16px]">
                          <Text className="text-[16px] leading-[24px]">{moment.text}</Text>
                        </Box>
                      )}
                      <MomentLink moment={moment} label={moment.teacher} onOpen={openMoment} />
                    </Fragment>
                  ))}
                </VStack>
              ))}
            </JumpSection>
          )}
          {!!d.scriptures?.length && (
            <JumpSection id="against" title="Scriptures against it" surface="rows">
              {d.scriptures.map(ref => (
                <ScriptureRow
                  key={ref.url}
                  label={ref.label}
                  text={verseText(ref)}
                  onPress={() => open(ref.url)}
                  footer={
                    ref.points.length ? (
                      <VStack className="gap-[10px] mt-[4px]">
                        {ref.points.map((point, n) => (
                          <Point key={n} moment={point} onOpen={openMoment} />
                        ))}
                      </VStack>
                    ) : null
                  }
                />
              ))}
            </JumpSection>
          )}
          {!!d.books?.length && (
            <JumpSection id="books" title="Books against it" surface="rows">
              {d.books.map(book => (
                <VStack key={book.title} className="px-[16px] py-[12px] gap-[6px]">
                  <Text className="text-[16px] font-bold">{book.title}</Text>
                  {(!!book.author || book.year != null) && (
                    <Text className="text-grey text-[13px]">
                      {[book.author, book.year].filter(v => v != null && v !== '').join(' · ')}
                    </Text>
                  )}
                  {book.pages?.map(page => (
                    <VStack key={`${page.vol}-${page.page}`} className="gap-[4px]">
                      <Text className="text-grey text-[13px] font-bold">
                        {page.vol === 1 ? `p. ${page.page}` : `vol. ${page.vol}, p. ${page.page}`}
                      </Text>
                      {page.quotes?.map((quote, n) => (
                        <Text key={n} className="text-[15px] leading-[22px]">
                          {quote.text}
                        </Text>
                      ))}
                    </VStack>
                  ))}
                  {!book.pages && !!book.said && <Point moment={book.said} onOpen={openMoment} />}
                </VStack>
              ))}
            </JumpSection>
          )}
          {related.length > 0 && (
            <JumpSection id="related" title="Related" surface="none">
              <ChipRow chips={related} onPress={open} />
            </JumpSection>
          )}
        </>
      )}
    </StudyPage>
  )
}

export default DoctrineScreen
