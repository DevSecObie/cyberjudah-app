import { ENTITY_AVATAR_IMAGES, getStrongEntityAvatarSource } from '../strongEntityAvatars'
import { getChapterEntityAvatarUri } from '~features/bible/BibleDOM/chapterEntityAvatar'
import type { StrongLexiconChapterEntity } from '~features/resources/strongLexiconAccess'

jest.mock('../cyberJudahPortraits', () => ({
  CYBERJUDAH_PORTRAITS: {
    'aaron-exo-4-14': '/portraits/aaron.webp',
    'eve-gen-3-20': '/portraits/eve.webp',
  },
}))
jest.mock('~assets/images/entity-avatars/male.png', () => '/avatars/male.png')
jest.mock('~assets/images/entity-avatars/female.png', () => '/avatars/female.png')
jest.mock('~assets/images/entity-avatars/group.png', () => '/avatars/group.png')
jest.mock('~assets/images/entity-avatars/place.png', () => '/avatars/place.png')
jest.mock('~assets/images/entity-avatars/supernatural.png', () => '/avatars/supernatural.png')
jest.mock('~assets/images/entity-avatars/time.png', () => '/avatars/time.png')
jest.mock('~assets/images/entity-avatars/musical.png', () => '/avatars/musical.png')
jest.mock('~assets/images/entity-avatars/other.png', () => '/avatars/other.png')
jest.mock('~assets/images/entity-avatars/title.png', () => '/avatars/title.png')
jest.mock('~assets/images/entity-avatars/language.png', () => '/avatars/language.png')
jest.mock('~assets/images/entity-avatars/star.png', () => '/avatars/star.png')

describe('owned person portraits', () => {
  it.each([
    ['Male', 'aaron-exo-4-14', '/portraits/aaron.webp'],
    ['Female', 'eve-gen-3-20', '/portraits/eve.webp'],
  ])(
    'uses the existing portrait for a %s person in native and chapter views',
    (type, uniqueName, expected) => {
      expect(getStrongEntityAvatarSource('person', type, uniqueName)).toBe(expected)
      expect(
        getChapterEntityAvatarUri({
          category: 'person',
          type,
          uniqueName,
        } as StrongLexiconChapterEntity)
      ).toBe(expected)
    }
  )

  it.each(['Male', 'Female'])(
    'keeps the default %s avatar for a person without a portrait',
    type => {
      const expected = type === 'Male' ? ENTITY_AVATAR_IMAGES.male : ENTITY_AVATAR_IMAGES.female
      expect(getStrongEntityAvatarSource('person', type, 'person-without-portrait')).toBe(expected)
      expect(getStrongEntityAvatarSource('person', type)).toBe(expected)
      expect(
        getChapterEntityAvatarUri({
          category: 'person',
          type,
          uniqueName: 'person-without-portrait',
        } as StrongLexiconChapterEntity)
      ).toBe(expected)
    }
  )

  it('keeps the existing non-person fallback', () => {
    expect(getStrongEntityAvatarSource('place', 'Place', 'place-without-portrait')).toBe(
      ENTITY_AVATAR_IMAGES.place
    )
  })
})
