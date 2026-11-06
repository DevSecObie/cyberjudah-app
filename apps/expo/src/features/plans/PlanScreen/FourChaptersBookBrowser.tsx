import { useState } from 'react'
import type { ComputedPlan } from '~common/types'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import { getFourChaptersBooks } from '../fourChaptersBooks'

export default function FourChaptersBookBrowser({
  plan,
  onSelect,
}: {
  plan: ComputedPlan
  onSelect: (day: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [selectedBook, setSelectedBook] = useState<string | null>(null)
  const sections = getFourChaptersBooks(plan.sections)
  return (
    <Box className="gap-[12px]">
      <Link
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center gap-[8px] py-[12px]"
      >
        <FeatherIcon name="book-open" size={20} color="primary" />
        <Text className="text-link text-[15px] font-bold">Browse by book</Text>
        <FeatherIcon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="primary" />
      </Link>
      {open && (
        <>
          <Text className="text-grey text-[13px]">
            Choose a book and chapter range. Browsing does not change your reading schedule.
          </Text>
          {sections.map(section => (
            <Box key={section.title} className="gap-[8px]">
              <Text className="text-grey text-[13px]">{section.title}</Text>
              <Card className="p-[12px] gap-[4px]">
                {section.books.map(book => (
                  <Box key={book.title}>
                    <Link
                      onPress={() =>
                        setSelectedBook(selectedBook === book.title ? null : book.title)
                      }
                      accessibilityRole="button"
                      accessibilityState={{ expanded: selectedBook === book.title }}
                      className="flex-row justify-between items-center py-[12px]"
                    >
                      <Text className="text-default text-[15px] font-bold">{book.title}</Text>
                      <FeatherIcon
                        name={selectedBook === book.title ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="primary"
                      />
                    </Link>
                    {selectedBook === book.title &&
                      book.readings.map(reading => (
                        <Link
                          key={reading.day}
                          onPress={() => {
                            onSelect(reading.day)
                            setOpen(false)
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`${book.title}, day ${reading.day}, ${reading.title}`}
                          className="py-[12px] pl-[12px]"
                        >
                          <Text className="text-link text-[14px]">{reading.title}</Text>
                          <Text className="text-grey text-[12px]">Day {reading.day}</Text>
                        </Link>
                      ))}
                  </Box>
                ))}
              </Card>
            </Box>
          ))}
        </>
      )}
    </Box>
  )
}
