import { createOsisReferenceTools } from '@bible-strong/bible-reference-parser/osis-reference'
export const { getSupportedOsisBookId, getSupportedOsisBookNumber, normalizeOsisReference } =
  createOsisReferenceTools(
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah' ? 'cyberjudah' : 'upstream'
  )
