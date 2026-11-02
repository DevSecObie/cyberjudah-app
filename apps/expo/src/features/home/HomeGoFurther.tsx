import { useTranslation } from 'react-i18next'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import ListSection, { ListRow } from '~common/ui/ListSection'
import { getAppleReviewing } from '~helpers/getAppleReviewing'
import useLanguage from '~helpers/useLanguage'
import { HomeGrid, useHomeLayout } from './homeLayout'

/**
 * « Aller plus loin »: Audibible and donation rows. A phone groups them in one card; a wide
 * home sets them side by side, each in its own card.
 */
const HomeGoFurther = () => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const { wide } = useHomeLayout()
  const appleIsReviewing = getAppleReviewing()

  const rows = [
    ...(appleIsReviewing
      ? []
      : [
          <ListRow
            key="donation"
            href={`https://bible-strong.app/${lang === 'fr' ? 'fr/' : ''}give`}
            label={t('donation.title')}
            description={t('donation.description')}
            accessibilityLabel={t('donation.title')}
            accessibilityHint={t('donation.description')}
            icon={<FeatherIcon name="heart" size={18} color="color2" />}
            iconTint="color2"
          />,
        ]),
  ]

  if (wide)
    return (
      <HomeGrid columns={2} rowGap={10} style={{ paddingBottom: 32 }}>
        {rows.map(row => (
          <Card key={row.key}>{row}</Card>
        ))}
      </HomeGrid>
    )

  return <ListSection className="mb-[32px]">{rows}</ListSection>
}

export default HomeGoFurther
