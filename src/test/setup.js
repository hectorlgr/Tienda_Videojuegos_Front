import '@testing-library/jest-dom/vitest'

// jsdom no implementa matchMedia, que ScrollTrigger usa al registrarse.
window.matchMedia ??= media => ({
  media,
  matches: media === '(prefers-reduced-motion: reduce)',
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
})
