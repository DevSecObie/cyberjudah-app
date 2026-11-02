import { CLASS_FRAME_SCRIPT, CLASS_PICTURE_IN_PICTURE_SCRIPT } from '../classVideoPosition'

describe('the scripts for the hosted video page', () => {
  it('parse as one script, and the Picture in Picture one only acts inside YouTube', () => {
    expect(() => new Function(CLASS_FRAME_SCRIPT)).not.toThrow()
    expect(CLASS_PICTURE_IN_PICTURE_SCRIPT).toContain('webkitSetPresentationMode')
    expect(CLASS_PICTURE_IN_PICTURE_SCRIPT).toContain('youtube(-nocookie)?\\.com$')
  })
})
