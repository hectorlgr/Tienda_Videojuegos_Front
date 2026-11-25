import { isRichDescription, sanitizeDescription } from '../../utils/productDescription'

export default function ProductDescription({ value, className, fromRawg }) {
  if (!value) return null

  if (fromRawg || !isRichDescription(value)) {
    return <p className={className}>{value}</p>
  }

  return (
    <div
      className={`product-rich-description ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: sanitizeDescription(value) }}
    />
  )
}
