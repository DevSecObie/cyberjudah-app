import { buildPlanQuiz, plainVerse, QUIZ_LENGTH, type QuizVerse } from '../planQuiz'

const verses: QuizVerse[] = [
  ['Genesis 1', 'Genesis 1:1', 'In the beginning God created the heaven and the earth.'],
  ['Genesis 1', 'Genesis 1:3', 'And God said, Let there be light: and there was light.'],
  [
    'Genesis 1',
    'Genesis 1:5',
    'And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.',
  ],
  [
    'Genesis 2',
    'Genesis 2:8',
    'And the LORD God planted a garden eastward in Eden; and there he put the man whom he had formed.',
  ],
  [
    'Genesis 2',
    'Genesis 2:15',
    'And the LORD God took the man, and put him into the garden of Eden to dress it and to keep it.',
  ],
  [
    'Genesis 2',
    'Genesis 2:19',
    'And out of the ground the LORD God formed every beast of the field, and every fowl of the air; and brought them unto Adam to see what he would call them.',
  ],
  [
    'Genesis 3',
    'Genesis 3:1',
    'Now the serpent was more subtil than any beast of the field which the LORD God had made.',
  ],
  [
    'Genesis 3',
    'Genesis 3:20',
    "And Adam called his wife's name Eve; because she was the mother of all living.",
  ],
  [
    'Genesis 3',
    'Genesis 3:23',
    'Therefore the LORD God sent him forth from the garden of Eden, to till the ground from whence he was taken.',
  ],
  [
    'Genesis 4',
    'Genesis 4:2',
    'And she again bare his brother Abel. And Abel was a keeper of sheep, but Cain was a tiller of the ground.',
  ],
  [
    'Genesis 4',
    'Genesis 4:8',
    'And Cain talked with Abel his brother: and it came to pass, when they were in the field, that Cain rose up against Abel his brother, and slew him.',
  ],
  [
    'Genesis 4',
    'Genesis 4:16',
    'And Cain went out from the presence of the LORD, and dwelt in the land of Nod, on the east of Eden.',
  ],
  [
    'Genesis 4',
    'Genesis 4:25',
    'And Adam knew his wife again; and she bare a son, and called his name Seth: For God, said she, hath appointed me another seed instead of Abel, whom Cain slew.',
  ],
].map(([chapterName, reference, text]) => ({ chapterName, reference, text }))

describe('buildPlanQuiz', () => {
  const quiz = buildPlanQuiz(verses, 'cyberjudah-four-chapters-a-day/1')

  it('asks ten questions', () => {
    expect(quiz).toHaveLength(QUIZ_LENGTH)
  })

  it('gives the same questions for the same day', () => {
    expect(buildPlanQuiz(verses, 'cyberjudah-four-chapters-a-day/1')).toEqual(quiz)
  })

  it('uses only the verses and their own words', () => {
    const words = new Set(verses.flatMap(verse => verse.text.match(/[A-Za-z]+/g) ?? []))
    for (const question of quiz) {
      const verse = verses.find(item => item.reference === question.reference)!
      expect(question.choices).toContain(question.answer)
      expect(new Set(question.choices).size).toBe(question.choices.length)
      if (question.kind === 'word') {
        expect(question.prompt.replace('_____', question.answer)).toBe(verse.text)
        question.choices.forEach(choice => expect(words.has(choice)).toBe(true))
      } else {
        expect(question.prompt).toBe(verse.text)
        expect(question.answer).toBe(verse.chapterName)
      }
    }
  })

  it('never asks the same verse twice', () => {
    expect(new Set(quiz.map(question => question.reference)).size).toBe(quiz.length)
  })

  it('reads the text without markup', () => {
    expect(plainVerse('In the <i>beginning</i>  God')).toBe('In the beginning God')
  })
})
