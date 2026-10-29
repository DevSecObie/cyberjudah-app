// The CyberJudah port keeps only Bible Strong's dictionary and Nave publications.
// Other editorial libraries need an explicit CyberJudah publication before they appear.
export const usesCyberJudahEditorial = () =>
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah'

export const canShowReadingPlan = (id: string) =>
  !usesCyberJudahEditorial() || !['bible-project-plan', 'bible-project-plan-en'].includes(id)
