import { getStrongEntityAvatarKey } from './strongEntityPresentation'
import { CYBERJUDAH_PORTRAITS } from './cyberJudahPortraits'
import { ISRAELITE_GROUPS } from './israeliteGroups'
import { NATIONS_PEOPLE } from './nationsPeople'

export const ENTITY_AVATAR_IMAGES = {
  male: require('~assets/images/entity-avatars/male.png'),
  female: require('~assets/images/entity-avatars/female.png'),
  group: require('~assets/images/entity-avatars/group.png'),
  place: require('~assets/images/entity-avatars/place.png'),
  supernatural: require('~assets/images/entity-avatars/supernatural.png'),
  time: require('~assets/images/entity-avatars/time.png'),
  musical: require('~assets/images/entity-avatars/musical.png'),
  other: require('~assets/images/entity-avatars/other.png'),
  title: require('~assets/images/entity-avatars/title.png'),
  language: require('~assets/images/entity-avatars/language.png'),
  star: require('~assets/images/entity-avatars/star.png'),
}

// Groups in clay: Israel's own (the tribes, their families, the Levites, the Jews) for Israel, and
// Bible Strong's grey clay groups for every other people. The same group always gets the same one.
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
const NATION_PEOPLE = {
  male: [
    require('~assets/images/entity-avatars/male-nations-1.webp'),
    require('~assets/images/entity-avatars/male-nations-2.webp'),
    require('~assets/images/entity-avatars/male-nations-3.webp'),
    require('~assets/images/entity-avatars/male-nations-4.webp'),
    require('~assets/images/entity-avatars/male-nations-5.webp'),
  ],
  female: [
    require('~assets/images/entity-avatars/female-nations-1.webp'),
    require('~assets/images/entity-avatars/female-nations-2.webp'),
    require('~assets/images/entity-avatars/female-nations-3.webp'),
    require('~assets/images/entity-avatars/female-nations-4.webp'),
    require('~assets/images/entity-avatars/female-nations-5.webp'),
  ],
}
const NATION_GROUPS = [
  require('~assets/images/entity-avatars/group-nations-1.webp'),
  require('~assets/images/entity-avatars/group-nations-2.webp'),
  require('~assets/images/entity-avatars/group-nations-3.webp'),
  require('~assets/images/entity-avatars/group-nations-4.webp'),
  require('~assets/images/entity-avatars/group-nations-5.webp'),
]
const seedIndex = (seed: string, size: number) => {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % size
}
const groupAvatar = (uniqueName: string) => {
  const set = ISRAELITE_GROUPS.has(uniqueName) ? ISRAEL_GROUPS : NATION_GROUPS
  return set[seedIndex(uniqueName, set.length)]
}
// Men and women in clay the same way: Israel's own for Israelites, Bible Strong's for the nations.
const personAvatar = (uniqueName: string, key: 'male' | 'female') => {
  const set = (NATIONS_PEOPLE.has(uniqueName) ? NATION_PEOPLE : ISRAEL_PEOPLE)[key]
  return set[seedIndex(uniqueName, set.length)]
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
