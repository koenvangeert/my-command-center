export const freezeMotionCss = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'

function nativeRoots(node, insideVideo = false, roots = []) {
  const isVideo = node.nodeName === 'VIDEO' && node.attributes?.some((name, index) => index % 2 === 0 && name === 'controls')
  insideVideo ||= isVideo
  if (insideVideo) for (const shadow of node.shadowRoots ?? []) roots.push({ nodeId: shadow.nodeId, topLevel: isVideo })
  for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? [])]) nativeRoots(child, insideVideo, roots)
  return roots
}

async function callInShadow(session, nodeId, functionDeclaration, values) {
  const { object } = await session.send('DOM.resolveNode', { nodeId })
  const result = await session.send('Runtime.callFunctionOn', {
    objectId: object.objectId, functionDeclaration, arguments: values.map(value => ({ value })), awaitPromise: true,
  })
  if (result.exceptionDetails) throw new Error(`Native media capture failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`)
}

/** Chromium's native controls live in nested UA shadow roots, outside document animation suppression. */
export async function freezeNativeMedia(page, timeout) {
  if (await page.locator('video[controls]').count() === 0) return
  await page.waitForFunction(() => [...document.querySelectorAll('video[controls]')].every(video => video.error || video.readyState >= 2))
  if (await page.locator('video[controls]').evaluateAll(videos => videos.some(video => !video.paused))) {
    throw new Error('Canonical video fixtures must be paused before capture')
  }
  const session = await page.context().newCDPSession(page)
  try {
    const { root } = await session.send('DOM.getDocument', { depth: -1, pierce: true })
    const roots = nativeRoots(root)
    if (!roots.length) throw new Error('Chromium did not expose native video controls for capture')
    for (const shadow of roots.filter(root => root.topLevel)) {
      await callInShadow(session, shadow.nodeId, `function(timeout) {
        // Both decoded frames and decode errors can precede the native buffering cycle's end.
        // Let the panel finish before freezing, rather than preserving a transient loading ring.
        const panel = this.querySelector('[pseudo="-internal-media-controls-loading-panel"]');
        if (!panel || getComputedStyle(panel).display === 'none') return;
        return new Promise((resolve, reject) => {
          const observer = new MutationObserver(check);
          const timer = setTimeout(() => finish(new Error('Native video buffering panel did not settle')), timeout);
          function finish(error) { observer.disconnect(); clearTimeout(timer); error ? reject(error) : resolve(); }
          function check() { if (!panel.isConnected || getComputedStyle(panel).display === 'none') finish(); }
          observer.observe(this, { attributes: true, childList: true, subtree: true });
          check();
        });
      }`, [timeout])
    }
    // Settling may remove transient native nodes. Resolve a fresh tree before applying styles.
    const settled = await session.send('DOM.getDocument', { depth: -1, pierce: true })
    for (const shadow of nativeRoots(settled.root)) {
      await callInShadow(session, shadow.nodeId, `function(css) {
        const style = this.ownerDocument.createElement('style');
        style.textContent = css;
        this.appendChild(style);
      }`, [freezeMotionCss])
    }
  } finally {
    await session.detach()
  }
}
