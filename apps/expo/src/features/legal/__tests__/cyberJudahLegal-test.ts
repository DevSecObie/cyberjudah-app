import { privacyPolicy, splitBold, supportPage, termsOfUse } from '../cyberJudahLegal'

const allText = [privacyPolicy, termsOfUse, supportPage]
  .flatMap(page => page.blocks)
  .flatMap(block => ('items' in block ? block.items : [block.text]))
  .join('\n')

describe('cyberJudahLegal', () => {
  it('splits bold segments', () => {
    expect(splitBold('**Need help?** Email us.')).toEqual([
      { text: 'Need help?', bold: true },
      { text: ' Email us.', bold: false },
    ])
  })

  it('names the contact address and account deletion path', () => {
    expect(allText).toContain('privacy@cyberjudah.io')
    expect(allText).toContain('More → Delete account')
  })

  it('leaves out affiliation and update-server lines', () => {
    expect(allText).not.toMatch(/IUIC|Israel United/)
    expect(allText).not.toMatch(/updates\.cyberjudah|location/i)
  })
})
