export const OFFLINE_SETUP_BIBLE_FACT_KEYS = [
  'offlineSetup.kjv.john832',
  'offlineSetup.kjv.john1415',
  'offlineSetup.kjv.john1717',
  'offlineSetup.kjv.psalm119105',
  'offlineSetup.kjv.psalm119142',
] as const

export const getRandomBibleFactIndex = (
  currentIndex?: number,
  random: () => number = Math.random
): number => {
  const factCount = OFFLINE_SETUP_BIBLE_FACT_KEYS.length

  if (currentIndex === undefined || factCount < 2) {
    return Math.floor(random() * factCount)
  }

  const randomIndexWithoutCurrent = Math.floor(random() * (factCount - 1))
  return randomIndexWithoutCurrent >= currentIndex
    ? randomIndexWithoutCurrent + 1
    : randomIndexWithoutCurrent
}
