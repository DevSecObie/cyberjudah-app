import React from 'react'
import { openInApp } from '~common/inAppBrowser'

import Paragraph from '~common/ui/Paragraph'

interface InlineLinkProps {
  href: string
  children: React.ReactNode
  [key: string]: unknown
}

const InlineLink = ({ href, children, ...props }: InlineLinkProps) => {
  return (
    <Paragraph
      onPress={() => openInApp(href)}
      fontFamily="text"
      {...props}
      className="text-link font-bold"
    >
      {children}
    </Paragraph>
  )
}

export default InlineLink
