interface Props {
  type: 'hebreu' | 'grec'
  code: string | number
  iconSize?: number
  touchSize?: number
}
export const hasStrongAudio = (_type: Props['type'], _code: Props['code']) => false
export default function ListenToStrong(_props: Props) {
  return null
}
