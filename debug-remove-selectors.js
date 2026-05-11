/**
 * STAG — Remove-Segment Selector Detector
 *
 * HOW TO USE:
 *  1. Open the Stensul campaign editor in Chrome.
 *  2. Select the target module so the segment list panel is visible on-screen.
 *  3. Open DevTools → Console.
 *  4. Paste this entire script and press Enter.
 *  5. Read the report and share it — the correct selectors will be patched into content.js.
 */

(function stagDebug() {
  console.clear();
  console.group('%c🔍 STAG Remove-Segment Selector Detector', 'color:#f97316;font-size:1.1em;font-weight:bold');

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ── 1. Dump all data-automation-id values on the page ─────────────────────
  const allAutoIds = [...document.querySelectorAll('[data-automation-id]')]
    .map(el => ({
      id:   el.getAttribute('data-automation-id'),
      tag:  el.tagName.toLowerCase(),
      text: el.textContent.trim().slice(0, 60),
      visible: (() => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
    }))
    .filter(x => x.visible);

  console.group('📋 All VISIBLE data-automation-id elements');
  console.table(allAutoIds);
  console.groupEnd();

  // ── 2. Look for segment list items ────────────────────────────────────────
  const segmentKeywords = ['segment', 'dca', 'scripted', 'condition'];
  const segmentItems = allAutoIds.filter(x =>
    segmentKeywords.some(k => x.id.toLowerCase().includes(k))
  );
  console.group('🎯 Segment-related automation IDs');
  console.table(segmentItems);
  console.groupEnd();

  // ── 3. Find all visible small buttons (kebab / options / 3-dot) ──────────
  const smallBtns = [...document.querySelectorAll('button, [role="button"]')]
    .map(el => {
      const r = el.getBoundingClientRect();
      return {
        el,
        tag:        el.tagName.toLowerCase(),
        automationId: el.getAttribute('data-automation-id') || '—',
        class:      el.className?.toString().slice(0, 80) || '—',
        text:       el.textContent.trim().slice(0, 40) || '(empty)',
        hasSvg:     !!el.querySelector('svg'),
        width:      Math.round(r.width),
        height:     Math.round(r.height),
        visible:    r.width > 0 && r.height > 0,
      };
    })
    .filter(x => x.visible && x.width < 60);

  console.group('🔘 All visible small buttons (w < 60px) — potential kebab menus');
  console.table(smallBtns.map(({ el, ...rest }) => rest));
  console.groupEnd();

  // ── 4. Click the first likely options button and inspect the dropdown ─────
  async function probeOptionsButton() {
    // Priority: data-automation-id containing kebab | options | menu | more
    const optionsBtnSelectors = [
      '[data-automation-id*="option"]',
      '[data-automation-id*="kebab"]',
      '[data-automation-id*="menu"]',
      '[data-automation-id*="more"]',
      '[data-automation-id*="action"]',
      '[data-automation-id*="dots"]',
    ];

    let optBtn = null;
    for (const sel of optionsBtnSelectors) {
      const candidates = [...document.querySelectorAll(sel)].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (candidates.length > 0) {
        optBtn = candidates[0];
        console.log(`%c✅ Options button candidate found via selector: ${sel}`, 'color:green');
        console.log('  Element:', optBtn);
        break;
      }
    }

    // Fallback: any small visible button with SVG (icon-only button)
    if (!optBtn) {
      const svgBtns = [...document.querySelectorAll('button, [role="button"]')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.width < 50 && el.querySelector('svg');
      });
      if (svgBtns.length > 0) {
        optBtn = svgBtns[0];
        console.warn('⚠️ No automation-id match — falling back to first small SVG button:', optBtn);
      }
    }

    if (!optBtn) {
      console.error('❌ Could not find any options/kebab button. Make sure the segment list panel is visible.');
      return;
    }

    // ── Click it and wait for a dropdown / menu to appear ─────────────────
    console.log('%c🖱 Clicking options button…', 'color:#f97316');
    optBtn.click();
    await sleep(700);

    // ── Capture everything newly visible after the click ──────────────────
    const menuCandidates = [
      ...[...document.querySelectorAll('li, [role="menuitem"], [role="option"]')].filter(el => {
        const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
      }),
      ...[...document.querySelectorAll('[class*="menu"], [class*="dropdown"], [class*="popover"], [class*="popup"]')].filter(el => {
        const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
      }),
    ];

    console.group('📂 Elements visible after clicking options button (menu items + containers)');
    console.table(menuCandidates.map(el => ({
      tag:          el.tagName.toLowerCase(),
      role:         el.getAttribute('role') || '—',
      automationId: el.getAttribute('data-automation-id') || '—',
      class:        el.className?.toString().slice(0, 80) || '—',
      text:         el.textContent.trim().slice(0, 60),
    })));
    console.groupEnd();

    // ── Specifically hunt for remove-related items ────────────────────────
    const removeKeywords = ['remove', 'delete', 'detach', 'unlink', 'discard'];
    const removeItems = menuCandidates.filter(el => {
      const txt = el.textContent.trim().toLowerCase();
      return removeKeywords.some(k => txt.includes(k));
    });

    if (removeItems.length > 0) {
      console.group('%c🎯 REMOVE menu items found!', 'color:green;font-weight:bold');
      removeItems.forEach(el => {
        console.log({
          element:      el,
          tag:          el.tagName.toLowerCase(),
          role:         el.getAttribute('role') || '—',
          automationId: el.getAttribute('data-automation-id') || '—',
          class:        el.className?.toString().slice(0, 100) || '—',
          text:         el.textContent.trim(),
        });
      });
      console.groupEnd();
    } else {
      console.warn('⚠️ No remove-related menu items found after clicking the options button.');
      console.log('  All menu candidates are listed above — share with developer.');
    }

    // ── Close the menu ────────────────────────────────────────────────────
    document.body.click();
    await sleep(300);
  }

  // ── 5. List all unique class names that contain "segment" ─────────────────
  const segmentClassEls = [...document.querySelectorAll('[class*="segment"], [class*="Segment"]')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

  console.group('🏷 Visible elements with "segment" in class name');
  console.table(segmentClassEls.map(el => ({
    tag:   el.tagName.toLowerCase(),
    class: el.className?.toString().slice(0, 100) || '—',
    automationId: el.getAttribute('data-automation-id') || '—',
    text:  el.textContent.trim().slice(0, 60),
  })));
  console.groupEnd();

  // ── Run the async probe ────────────────────────────────────────────────────
  probeOptionsButton().then(() => {
    console.log('%c\n✅ Scan complete. Share the above output so selectors can be patched.', 'color:#f97316;font-weight:bold');
    console.groupEnd();
  });

})();
