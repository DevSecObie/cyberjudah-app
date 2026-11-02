import {
  CLASS_FRAME_SCRIPT,
  CLASS_PICTURE_IN_PICTURE_SCRIPT,
  classPictureInPictureFromMessage,
} from '../classVideoPosition'

describe('the scripts for the hosted video page', () => {
  it('parse as one script, and the Picture in Picture one only acts inside YouTube', () => {
    expect(() => new Function(CLASS_FRAME_SCRIPT)).not.toThrow()
    expect(CLASS_PICTURE_IN_PICTURE_SCRIPT).toContain('webkitSetPresentationMode')
    expect(CLASS_PICTURE_IN_PICTURE_SCRIPT).toContain('youtube(-nocookie)?\\.com$')
  })
})

describe('Picture in Picture messages', () => {
  it('reads whether the video went into or out of Picture in Picture', () => {
    expect(classPictureInPictureFromMessage('{"classPictureInPicture":true}')).toBe(true)
    expect(classPictureInPictureFromMessage('{"classPictureInPicture":false}')).toBe(false)
    expect(classPictureInPictureFromMessage('{"classTime":12}')).toBeUndefined()
  })
})
