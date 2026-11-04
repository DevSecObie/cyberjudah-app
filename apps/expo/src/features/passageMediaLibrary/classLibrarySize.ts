/** The download's size, for asking first: the library as the data server sends it. */
export const CLASS_INDEX_DOWNLOAD_MB = 61
/** The library arrives gzipped and is kept unpacked, about three times the size sent. */
export const CLASS_INDEX_UNPACKED_RATIO = 2.9

export const CLASS_INDEX_DOWNLOAD_BYTES = CLASS_INDEX_DOWNLOAD_MB * 1048576
export const CLASS_INDEX_INSTALLED_BYTES = Math.round(
  CLASS_INDEX_DOWNLOAD_BYTES * CLASS_INDEX_UNPACKED_RATIO
)
