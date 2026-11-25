import DOMPurify from 'dompurify'

const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'h3', 'ul', 'ol', 'li']
const options = { ALLOWED_TAGS: allowedTags, ALLOWED_ATTR: [], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false }

export const SHORT_DESCRIPTION_LIMIT = 120
export const LONG_DESCRIPTION_LIMIT = 500
export const SHORT_DESCRIPTION_HTML_LIMIT = 500

export function sanitizeDescription(html, allowLinks = false) {
  return DOMPurify.sanitize(html, allowLinks ? {
    ...options,
    ALLOWED_TAGS: [...allowedTags, 'a', 'h4'],
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  } : options)
}

export function getDescriptionText(html) {
  return DOMPurify.sanitize(html, { ...options, RETURN_DOM_FRAGMENT: true }).textContent.trim()
}

export function isRichDescription(value) {
  return /^\s*<(?:p|h3|ul|ol)>/i.test(value)
}
