/** Runs in the browser. CSS reduced motion does not stop SMIL inside SVG masks.
 * Derive a static terminal frame from the production image, not a fixture icon.
 */
export function freezeSvgMasks(frame = 'terminal') {
  for (const element of document.querySelectorAll('*')) {
    const image = getComputedStyle(element).maskImage
    const match = /^url\("data:image\/svg\+xml,([^"]+)"\)$/.exec(image)
    if (!match) continue
    const svg = new DOMParser().parseFromString(decodeURIComponent(match[1]), 'image/svg+xml')
    const animations = svg.querySelectorAll('animate, animateTransform, animateMotion, set')
    if (!animations.length) continue
    for (const animation of animations) {
      const attribute = animation.getAttribute('attributeName')
      const values = animation.getAttribute('values')?.split(';')
      const value = frame === 'middle'
        ? values?.[Math.floor(values.length / 2)]?.trim() ?? animation.getAttribute('to')
        : animation.getAttribute('to') ?? values?.at(-1)?.trim()
      if (!attribute || !value || !['animate', 'animateTransform'].includes(animation.localName)
        || animation.getAttribute('additive') === 'sum' || animation.hasAttribute('href')) {
        throw new Error('Unsupported SVG mask animation in visual capture')
      }
      const terminal = animation.localName === 'animateTransform'
        ? `${animation.getAttribute('type')}(${value})` : value
      animation.parentElement.setAttribute(attribute, terminal)
      animation.remove()
    }
    const frozen = new XMLSerializer().serializeToString(svg.documentElement)
    element.style.setProperty('mask-image', `url("data:image/svg+xml,${encodeURIComponent(frozen)}")`, 'important')
  }
}
