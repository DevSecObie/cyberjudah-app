interface Props {
  type: 'hebreu' | 'grec'
  code: string | number
  iconSize?: number
  touchSize?: number
}

// No owned pronunciation recordings are available yet.
export const hasStrongAudio = (_type: Props['type'], _code: Props['code']) => false
const ListenToStrong = (_props: Props) => null
export default ListenToStrong
