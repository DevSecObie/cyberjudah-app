import React from 'react'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { titleFontStyle } from '~themes/styleValues'
import Header from '~common/Header'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { CYBERJUDAH_CONTACT_EMAIL, LegalPage, splitBold } from './cyberJudahLegal'

const RichText = ({ text }: { text: string }) => (
  <>
    {splitBold(text).map((part, index) => (
      <Paragraph key={index} scale={-1} className={part.bold ? 'font-bold' : undefined}>
        {part.text}
      </Paragraph>
    ))}
  </>
)

const LegalScreen = ({ page }: { page: LegalPage }) => {
  const stylingTheme = useStylingTheme()

  return (
    <Container className="bg-canvas">
      <Header hasBackButton title={page.title} />
      <ScrollView backgroundColor="canvas">
        <Box className="px-[24px] pb-[40px] w-full max-w-[720px] self-center">
          <Text
            className={page.updated ? 'text-[28px] mb-[6px]' : 'text-[28px] mb-[16px]'}
            style={titleFontStyle(stylingTheme)}
          >
            {page.title}
          </Text>
          {!!page.updated && (
            <Text className="text-grey text-[13px] mb-[16px] italic">{page.updated}</Text>
          )}
          {page.blocks.map((block, index) => {
            if (block.type === 'heading') {
              return (
                <Text
                  key={index}
                  accessibilityRole="header"
                  className="text-[18px] font-bold mt-[20px] mb-[8px]"
                >
                  {block.text}
                </Text>
              )
            }
            if (block.type === 'paragraph') {
              return (
                <Paragraph key={index} scale={-1} className="mb-[12px]">
                  <RichText text={block.text} />
                </Paragraph>
              )
            }
            return (
              <Box key={index} className="mb-[12px]">
                {block.items.map((item, itemIndex) => (
                  <Box key={itemIndex} className="flex-row mb-[8px]">
                    <Paragraph scale={-1} className="w-[24px]">
                      {block.type === 'numbered' ? `${itemIndex + 1}.` : '•'}
                    </Paragraph>
                    <Paragraph scale={-1} className="flex-1">
                      <RichText text={item} />
                    </Paragraph>
                  </Box>
                ))}
              </Box>
            )
          })}
          <Box className="flex-row flex-wrap gap-x-[20px] mt-[24px]">
            <Link route="Privacy" className="py-[8px]">
              <Text className="text-link text-[14px]">Privacy Policy</Text>
            </Link>
            <Link route="Terms" className="py-[8px]">
              <Text className="text-link text-[14px]">Terms of Use</Text>
            </Link>
            <Link route="Support" className="py-[8px]">
              <Text className="text-link text-[14px]">Support</Text>
            </Link>
            <Link href={`mailto:${CYBERJUDAH_CONTACT_EMAIL}`} className="py-[8px]">
              <Text className="text-link text-[14px]">{CYBERJUDAH_CONTACT_EMAIL}</Text>
            </Link>
          </Box>
        </Box>
      </ScrollView>
    </Container>
  )
}

export default LegalScreen
