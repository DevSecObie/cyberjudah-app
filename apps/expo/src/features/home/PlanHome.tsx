import { Asset } from 'expo-asset'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import Link from '~common/Link'
import type { Plan } from '~common/types'
import Box from '~common/ui/Box'
import Card from '~common/ui/Card'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { ListRow, ListSeparator } from '~common/ui/ListSection'
import {
  useComputedPlanItems,
  useDownloadFollowedPlans,
  useUpdatePlans,
} from '~features/plans/plan.hooks'
import { getEditorialKind } from '~features/plans/readingCalendar'
import { hasPlanParticipation } from '~features/plans/planProgress'
import FollowedPlanCard from '~features/plans/FollowedPlanCard'
import useLanguage from '~helpers/useLanguage'
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
import { addPlan, replacePlan } from '~redux/modules/plan'
import type { RootState } from '~redux/modules/reducer'

/** Where the text of a `FollowedPlanCard` row starts: its padding, its 40-point cover and the gap. */
const FOLLOWED_PLAN_TEXT_INSET = 16 + 40 + 12

const readResponseText = async (response: Response): Promise<string> => {
  if (!response.ok) {
    throw new Error(`Failed to load bundled plan: HTTP ${response.status}`)
  }
  return response.text()
}

// CyberJudah's own journey, built from the 4 Chapters a Day notes
// (scripts/build-cyberjudah-four-chapters-plan.mjs).
const FOUR_CHAPTERS_PLAN_ID = 'cyberjudah-four-chapters-a-day'

const bundledPlanModule = (lang: string) =>
  usesCyberJudahEditorial()
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('~assets/plans/cyberjudah-four-chapters-a-day.txt')
    : lang === 'fr'
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('~assets/plans/bible-project-plan.txt')
      : // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('~assets/plans/bible-project-plan-en.txt')

const loadBundledPlan = async (lang: string): Promise<Plan | undefined> => {
  const [asset] = await Asset.loadAsync(bundledPlanModule(lang))

  let serialized: string | undefined
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri)
    serialized = await readResponseText(response)
  } else if (asset.localUri) {
    const FileSystem = await import('expo-file-system/legacy')
    serialized = await FileSystem.readAsStringAsync(asset.localUri)
  }

  return serialized ? (JSON.parse(serialized) as Plan) : undefined
}

const useGetFirstPlans = () => {
  const lang = useLanguage()
  const planId = usesCyberJudahEditorial()
    ? FOUR_CHAPTERS_PLAN_ID
    : lang === 'fr'
      ? 'bible-project-plan'
      : 'bible-project-plan-en'
  const hasPlan = useSelector((state: RootState) =>
    state.plan.myPlans.some(plan => plan.id === planId)
  )
  // Our bundled plan is refreshed on every open, so a phone that added it earlier gets new rows.
  const refreshBundled = usesCyberJudahEditorial()
  const dispatch = useDispatch()
  useEffect(() => {
    if (hasPlan && !refreshBundled) return
    let active = true
    void loadBundledPlan(lang)
      .then(plan => {
        if (active && plan) dispatch(refreshBundled ? replacePlan(plan) : addPlan(plan))
      })
      .catch(error => console.warn('[Home] Could not load bundled reading plan', error))
    return () => {
      active = false
    }
  }, [hasPlan, refreshBundled, lang, dispatch])
}

/** « À découvrir », the link to the plan catalogue. */
export const PlansExploreLink = () => {
  const { t } = useTranslation()
  return (
    <Link
      route="Plans"
      className="flex-row items-center gap-[6px] py-[12px]"
      accessibilityLabel={t('readingPlans.explorePlans')}
    >
      <Text className="text-link text-[13px] font-bold">{t('readingPlans.explore')}</Text>
    </Link>
  )
}

/** Reading plans the reader has started, with their participation. */
export const useFollowedPlans = () => {
  const plans = useComputedPlanItems()
  const participations = useSelector((state: RootState) => state.plan.ongoingPlans)
  return plans.flatMap(plan => {
    const participation = participations.find(item => item.id === plan.id)
    if (getEditorialKind(plan) !== 'reading-plan') return []
    if (participation && hasPlanParticipation(participation)) return [{ plan, participation }]
    // 4 Chapters a Day is CyberJudah's daily reading, so it waits under Your journeys before it starts.
    return plan.id === FOUR_CHAPTERS_PLAN_ID
      ? [{ plan, participation: { id: plan.id, status: 'Idle' as const, readingSlices: {} } }]
      : []
  })
}

/**
 * Followed reading plans as rows, or an invitation to explore them. The home places it under
 * its « Mes plans » title, inside the gutters. Progress syncs but plan content is per device,
 * so the home downloads the content of followed plans this device lacks.
 */
const PlanHome = () => {
  const { t } = useTranslation()
  const followed = useFollowedPlans()
  useUpdatePlans()
  useGetFirstPlans()
  useDownloadFollowedPlans()

  if (!followed.length) {
    return (
      <Card>
        <ListRow
          route="Plans"
          accessibilityLabel={t('readingPlans.explorePlans')}
          icon={<FeatherIcon name="book-open" size={18} color="primary" />}
          iconTint="primary"
          label={t('readingPlans.explorePlans')}
          description={t('readingPlans.readAtYourPace')}
        />
      </Card>
    )
  }

  return (
    <Card>
      {followed.map(({ plan, participation }, index) => (
        <Box key={plan.id}>
          {index > 0 && <ListSeparator inset={FOLLOWED_PLAN_TEXT_INSET} />}
          <FollowedPlanCard plan={plan} participation={participation} />
        </Box>
      ))}
    </Card>
  )
}

export default PlanHome
