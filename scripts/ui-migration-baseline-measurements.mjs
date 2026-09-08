import assert from 'node:assert/strict'

export async function measureTargets(page, targets) {
  const elements = []
  for (const { id, selector, knownInvisibleReason } of targets) {
    const target = page.locator(selector)
    assert.equal(await target.count(), 1, `${id}: expected exactly one visible target: ${selector}`)
    const visible = await target.isVisible()
    assert.ok(visible || knownInvisibleReason?.trim(), `${id}: expected exactly one visible target: ${selector}`)
    const measured = await target.evaluate(element => {
      const style = getComputedStyle(element)
      const bounds = element.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(element)
      const textLineTops = [...new Set([...range.getClientRects()].map(rect => rect.top))]
      let clippedByZeroAncestor = false
      // Root overflow clips to the viewport, not body's often-zero layout box around fixed dialogs.
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const parentStyle = getComputedStyle(parent)
        if (parentStyle.display === 'contents') continue
        const rect = parent.getBoundingClientRect()
        if ((rect.width === 0 && parentStyle.overflowX !== 'visible') || (rect.height === 0 && parentStyle.overflowY !== 'visible')) clippedByZeroAncestor = true
      }
      return {
        clippedByZeroAncestor,
        tag: element.tagName, label: element.getAttribute('aria-label'), text: element.textContent.trim().slice(0, 200),
        role: element.getAttribute('role'), live: element.getAttribute('aria-live'),
        disabled: element.matches(':disabled'), invalid: element.getAttribute('aria-invalid'),
        selected: element.getAttribute('aria-selected') ?? element.getAttribute('aria-pressed') ?? element.getAttribute('aria-checked'),
        checked: element.matches(':checked'),
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        color: style.color, background: style.backgroundColor, border: style.borderColor, radius: style.borderRadius,
        font: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight, whiteSpace: style.whiteSpace,
        clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
        opacity: style.opacity, boxShadow: style.boxShadow, maskImage: style.maskImage, animationDuration: style.animationDuration,
        display: style.display, visibility: style.visibility,
        textLineTops, outline: style.outline, focusVisible: element.matches(':focus-visible'),
      }
    })
    assert.ok(!measured.clippedByZeroAncestor || knownInvisibleReason?.trim(), `${id}: expected exactly one visible target: ${selector}`)
    elements.push({ id, selector, visible, ...(knownInvisibleReason ? { knownInvisibleReason } : {}), ...measured })
  }
  return { ...await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, fonts: document.fonts.status,
    bodyFont: getComputedStyle(document.body).fontFamily, overflow: document.documentElement.scrollWidth > innerWidth })), elements }
}
