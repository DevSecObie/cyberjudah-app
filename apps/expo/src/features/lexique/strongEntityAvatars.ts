<<<<<<< CYBERJUDAH
import { getStrongEntityAvatarKey } from './strongEntityPresentation'
import { CYBERJUDAH_PORTRAITS } from './cyberJudahPortraits'
import { ISRAELITE_GROUPS } from './israeliteGroups'
import { JUDAH_PEOPLE } from './judahPeople'
import { PEOPLE_NATIONS, type PeopleNation } from './peopleNations'
=======
import { getEntityPlaceholderIndex } from './entityPortraits'
import { getStrongEntityAvatarKey, type StrongEntityAvatarKey } from './strongEntityPresentation'
>>>>>>> BIBLESTRONG-28

// Grey clay figures for the entities without a portrait (ADR-0089): five for people and groups, so that
// neighbours in a chapter differ, one for the other avatar keys.
export const ENTITY_PLACEHOLDER_IMAGES = {
  male: [
    require('~assets/images/entity-avatars/male-1.webp'),
    require('~assets/images/entity-avatars/male-2.webp'),
    require('~assets/images/entity-avatars/male-3.webp'),
    require('~assets/images/entity-avatars/male-4.webp'),
    require('~assets/images/entity-avatars/male-5.webp'),
  ],
  female: [
    require('~assets/images/entity-avatars/female-1.webp'),
    require('~assets/images/entity-avatars/female-2.webp'),
    require('~assets/images/entity-avatars/female-3.webp'),
    require('~assets/images/entity-avatars/female-4.webp'),
    require('~assets/images/entity-avatars/female-5.webp'),
  ],
  group: [
    require('~assets/images/entity-avatars/group-1.webp'),
    require('~assets/images/entity-avatars/group-2.webp'),
    require('~assets/images/entity-avatars/group-3.webp'),
    require('~assets/images/entity-avatars/group-4.webp'),
    require('~assets/images/entity-avatars/group-5.webp'),
  ],
  place: [require('~assets/images/entity-avatars/place-1.webp')],
  supernatural: [require('~assets/images/entity-avatars/supernatural-1.webp')],
  time: [require('~assets/images/entity-avatars/time-1.webp')],
  musical: [require('~assets/images/entity-avatars/musical-1.webp')],
  other: [require('~assets/images/entity-avatars/other-1.webp')],
  title: [require('~assets/images/entity-avatars/title-1.webp')],
  language: [require('~assets/images/entity-avatars/language-1.webp')],
  star: [require('~assets/images/entity-avatars/star-1.webp')],
} satisfies Record<StrongEntityAvatarKey, unknown[]>

<<<<<<< CYBERJUDAH
// Groups in clay: Israel's own (the tribes, their families, the Levites, the Jews) for Israel, and
// each other people's own nation. The same group always gets the same one.
const ISRAEL_GROUPS = [
  require('~assets/images/entity-avatars/group-israel-1.webp'),
  require('~assets/images/entity-avatars/group-israel-2.webp'),
  require('~assets/images/entity-avatars/group-israel-3.webp'),
  require('~assets/images/entity-avatars/group-israel-4.webp'),
  require('~assets/images/entity-avatars/group-israel-5.webp'),
]
const ISRAEL_PEOPLE = {
  male: [
    require('~assets/images/entity-avatars/male-israel-1.webp'),
    require('~assets/images/entity-avatars/male-israel-2.webp'),
    require('~assets/images/entity-avatars/male-israel-3.webp'),
    require('~assets/images/entity-avatars/male-israel-4.webp'),
    require('~assets/images/entity-avatars/male-israel-5.webp'),
  ],
  female: [
    require('~assets/images/entity-avatars/female-israel-1.webp'),
    require('~assets/images/entity-avatars/female-israel-2.webp'),
    require('~assets/images/entity-avatars/female-israel-3.webp'),
    require('~assets/images/entity-avatars/female-israel-4.webp'),
    require('~assets/images/entity-avatars/female-israel-5.webp'),
  ],
}
// The nations in clay, one figure each for a man, a woman and a people, after the Table of Nations
// the classes teach. Ham, the father of the dark Hamitic nations, is shown as Cush his firstborn.
const NATION_FIGURES: Record<
  Exclude<PeopleNation, 'ham'>,
  Record<'male' | 'female' | 'group', number>
> = {
  ammon: {
    male: require('~assets/images/entity-avatars/male-ammon.jpg'),
    female: require('~assets/images/entity-avatars/female-ammon.jpg'),
    group: require('~assets/images/entity-avatars/group-ammon.jpg'),
  },
  aram: {
    male: require('~assets/images/entity-avatars/male-aram.jpg'),
    female: require('~assets/images/entity-avatars/female-aram.jpg'),
    group: require('~assets/images/entity-avatars/group-aram.jpg'),
  },
  ashkenaz: {
    male: require('~assets/images/entity-avatars/male-ashkenaz.jpg'),
    female: require('~assets/images/entity-avatars/female-ashkenaz.jpg'),
    group: require('~assets/images/entity-avatars/group-ashkenaz.jpg'),
  },
  asshur: {
    male: require('~assets/images/entity-avatars/male-asshur.jpg'),
    female: require('~assets/images/entity-avatars/female-asshur.jpg'),
    group: require('~assets/images/entity-avatars/group-asshur.jpg'),
  },
  canaan: {
    male: require('~assets/images/entity-avatars/male-canaan.jpg'),
    female: require('~assets/images/entity-avatars/female-canaan.jpg'),
    group: require('~assets/images/entity-avatars/group-canaan.jpg'),
  },
  cush: {
    male: require('~assets/images/entity-avatars/male-cush.jpg'),
    female: require('~assets/images/entity-avatars/female-cush.jpg'),
    group: require('~assets/images/entity-avatars/group-cush.jpg'),
  },
  edom: {
    male: require('~assets/images/entity-avatars/male-edom.jpg'),
    female: require('~assets/images/entity-avatars/female-edom.jpg'),
    group: require('~assets/images/entity-avatars/group-edom.jpg'),
  },
  elam: {
    male: require('~assets/images/entity-avatars/male-elam.jpg'),
    female: require('~assets/images/entity-avatars/female-elam.jpg'),
    group: require('~assets/images/entity-avatars/group-elam.jpg'),
  },
  gomer: {
    male: require('~assets/images/entity-avatars/male-gomer.jpg'),
    female: require('~assets/images/entity-avatars/female-gomer.jpg'),
    group: require('~assets/images/entity-avatars/group-gomer.jpg'),
  },
  ishmael: {
    male: require('~assets/images/entity-avatars/male-ishmael.jpg'),
    female: require('~assets/images/entity-avatars/female-ishmael.jpg'),
    group: require('~assets/images/entity-avatars/group-ishmael.jpg'),
  },
  japheth: {
    male: require('~assets/images/entity-avatars/male-japheth.jpg'),
    female: require('~assets/images/entity-avatars/female-japheth.jpg'),
    group: require('~assets/images/entity-avatars/group-japheth.jpg'),
  },
  javan: {
    male: require('~assets/images/entity-avatars/male-javan.jpg'),
    female: require('~assets/images/entity-avatars/female-javan.jpg'),
    group: require('~assets/images/entity-avatars/group-javan.jpg'),
  },
  kittim: {
    male: require('~assets/images/entity-avatars/male-kittim.jpg'),
    female: require('~assets/images/entity-avatars/female-kittim.jpg'),
    group: require('~assets/images/entity-avatars/group-kittim.jpg'),
  },
  magog: {
    male: require('~assets/images/entity-avatars/male-magog.jpg'),
    female: require('~assets/images/entity-avatars/female-magog.jpg'),
    group: require('~assets/images/entity-avatars/group-magog.jpg'),
  },
  mizraim: {
    male: require('~assets/images/entity-avatars/male-mizraim.jpg'),
    female: require('~assets/images/entity-avatars/female-mizraim.jpg'),
    group: require('~assets/images/entity-avatars/group-mizraim.jpg'),
  },
  moab: {
    male: require('~assets/images/entity-avatars/male-moab.jpg'),
    female: require('~assets/images/entity-avatars/female-moab.jpg'),
    group: require('~assets/images/entity-avatars/group-moab.jpg'),
  },
  phut: {
    male: require('~assets/images/entity-avatars/male-phut.jpg'),
    female: require('~assets/images/entity-avatars/female-phut.jpg'),
    group: require('~assets/images/entity-avatars/group-phut.jpg'),
  },
  tarshish: {
    male: require('~assets/images/entity-avatars/male-tarshish.jpg'),
    female: require('~assets/images/entity-avatars/female-tarshish.jpg'),
    group: require('~assets/images/entity-avatars/group-tarshish.jpg'),
  },
}
const nationFigure = (uniqueName: string) => {
  const nation = PEOPLE_NATIONS[uniqueName]
  return nation && NATION_FIGURES[nation === 'ham' ? 'cush' : nation]
}
const seedIndex = (seed: string, size: number) => {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % size
}
const groupAvatar = (uniqueName: string) =>
  nationFigure(uniqueName)?.group ??
  (ISRAELITE_GROUPS.has(uniqueName)
    ? ISRAEL_GROUPS[seedIndex(uniqueName, ISRAEL_GROUPS.length)]
    : undefined)
// The figures of Israel that are Black: every one but the third, who is Native American. The tribe
// of Judah only ever gets these.
const JUDAH_FIGURES = {
  male: ISRAEL_PEOPLE.male.filter((_, index) => index !== 2),
  female: ISRAEL_PEOPLE.female.filter((_, index) => index !== 2),
}
// Men and women the same way: their nation's figure, else Israel's own (Judah's always Black).
const personAvatar = (uniqueName: string, key: 'male' | 'female') => {
  const nation = nationFigure(uniqueName)?.[key]
  if (nation) return nation
  const figures = JUDAH_PEOPLE.has(uniqueName) ? JUDAH_FIGURES[key] : ISRAEL_PEOPLE[key]
  return figures[seedIndex(uniqueName, figures.length)]
}

/** A person's own portrait where CyberJudah has one, else the avatar for their kind. */
export const getStrongEntityAvatarSource = (category: string, type: string, uniqueName?: string) =>
  (uniqueName && CYBERJUDAH_PORTRAITS[uniqueName]) ||
  (uniqueName && getStrongEntityAvatarKey(category, type) === 'group' && groupAvatar(uniqueName)) ||
  (uniqueName &&
    (getStrongEntityAvatarKey(category, type) === 'male' ||
      getStrongEntityAvatarKey(category, type) === 'female') &&
    personAvatar(uniqueName, getStrongEntityAvatarKey(category, type) as 'male' | 'female')) ||
  ENTITY_AVATAR_IMAGES[getStrongEntityAvatarKey(category, type)]
=======
/** The placeholder of an entity, the same wherever it is drawn. `seed` is its unique name. */
export const getStrongEntityPlaceholderSource = (category: string, type: string, seed: string) => {
  const images = ENTITY_PLACEHOLDER_IMAGES[getStrongEntityAvatarKey(category, type)]
  return images[getEntityPlaceholderIndex(seed, images.length)]
}
>>>>>>> BIBLESTRONG-28
