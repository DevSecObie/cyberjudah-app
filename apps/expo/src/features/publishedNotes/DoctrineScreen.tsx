import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { SafeAreaBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import { loadDoctrine } from './classTeaching'
import { LinkRow, MomentLink, Scripture, Section, Teaching } from './parts'
import { useOpenSiteLink } from './siteLinks'

const RELATED = [
  ['precepts', 'Related precepts'],
  ['cases', 'Related cases'],
  ['topics', 'Related topics'],
] as const

/** A false doctrine: the claim, then scripture and the classes' teaching against it (as in Telegram). */
const DoctrineScreen = () => {
  const theme = useTheme()
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

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header hasBackButton title={d?.name ?? 'False Doctrines'} />
      {entry.isPending ? (
        <Loading />
      ) : d ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <Text
            className="text-[26px] leading-[32px]"
            style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
          >
            {d.name}
          </Text>
          <Section title="False claim">
            <Text className="text-[16px] leading-[24px] italic">{d.claim}</Text>
          </Section>
          {d.answers.length > 0 && (
            <Section title="Scripture & teaching">
              {d.answers.map((answer, i) => (
                <VStack key={i} className="gap-[10px]">
                  {answer.refs.map(ref => (
                    <Scripture key={ref.url} scripture={ref} onOpen={open} />
                  ))}
                  {answer.sense.map((moment, n) => (
                    <Teaching key={n} moment={moment} label={moment.teacher} onOpen={openMoment} />
                  ))}
                </VStack>
              ))}
            </Section>
          )}
          {!!d.scriptures?.length && (
            <Section title="Scriptures against it">
              {d.scriptures.map(ref => (
                <VStack key={ref.url} className="gap-[8px]">
                  <Scripture scripture={ref} onOpen={open} />
                  {ref.points.map((point, n) =>
                    point.read ? (
                      <MomentLink
                        key={n}
                        moment={point}
                        label={`Read in ${point.title}`}
                        onOpen={openMoment}
                      />
                    ) : (
                      <Teaching
                        key={n}
                        moment={point}
                        label={[point.teacher, point.title].filter(Boolean).join(' · ')}
                        onOpen={openMoment}
                      />
                    )
                  )}
                </VStack>
              ))}
            </Section>
          )}
          {!!d.books?.length && (
            <Section title="Books against it">
              {d.books.map(book => (
                <VStack key={book.title} className="gap-[6px]">
                  <Text className="text-[16px] font-bold">{book.title}</Text>
                  {(!!book.author || book.year != null) && (
                    <Text className="text-grey text-[13px]">
                      {[book.author, book.year].filter(v => v != null && v !== '').join(' · ')}
                    </Text>
                  )}
                  {book.pages?.map(page => (
                    <VStack key={`${page.vol}-${page.page}`} className="gap-[4px]">
                      <Text className="text-primary text-[13px] font-bold">
                        {page.vol === 1 ? `p. ${page.page}` : `vol. ${page.vol}, p. ${page.page}`}
                      </Text>
                      {page.quotes?.map((quote, n) => (
                        <Box key={n} className="border-l-[3px] border-border pl-[12px]">
                          <Text className="text-[15px] leading-[22px]">{quote.text}</Text>
                        </Box>
                      ))}
                    </VStack>
                  ))}
                  {!book.pages && !!book.said && (
                    <Teaching
                      moment={book.said}
                      label={[book.said.teacher, book.said.title].filter(Boolean).join(' · ')}
                      onOpen={openMoment}
                    />
                  )}
                </VStack>
              ))}
            </Section>
          )}
          {RELATED.map(([kind, title]) =>
            d.related?.[kind]?.length ? (
              <Section key={kind} title={title}>
                {d.related[kind].map(item => (
                  <LinkRow
                    key={item.slug}
                    title={item.title ?? item.name ?? item.label ?? item.slug}
                    onPress={() => open(item.url)}
                  />
                ))}
              </Section>
            ) : null
          )}
        </ScrollView>
      ) : (
        <Box className="py-[60px] px-[20px] items-center">
          <Text className="text-grey text-center">
            This false doctrine did not load. Check your connection.
          </Text>
        </Box>
      )}
    </SafeAreaBox>
  )
}

export default DoctrineScreen
