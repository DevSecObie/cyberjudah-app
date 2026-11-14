import { twMerge } from '~common/ui/classNames'

import Text from '~common/ui/Text'
import { LOOK_OS } from '~helpers/lookPlatform'
const InterlinearMark = ({
  highlighted = false,
  passive = false,
  className,
}: {
  highlighted?: boolean
  passive?: boolean
  className?: string
}) => {
  return (
    <Text
      className={twMerge(
        passive ? 'text-default' : highlighted ? 'text-link' : 'text-tertiary',
        'text-[17px] font-bold',
        className
      )}
      style={{ fontFamily: LOOK_OS === 'ios' ? 'Georgia' : 'serif' }}
    >
      I
    </Text>
  )
}

export default InterlinearMark
