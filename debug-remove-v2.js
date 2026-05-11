/**
 * STAG — Remove-Segment Dropdown Inspector (v2)
 *
 * PURPOSE: Click the confirmed "segment-actions" button on the first segment,
 *          then capture every element that appears in the dropdown so the
 *          correct remove-item selector can be patched into content.js.
 *
 * HOW TO USE:
 *  1. Open the Stensul campaign editor.
 *  2. Select the target module — the segment list must be visible on the right.
 *  3. DevTools → Console → paste this script → Enter.
 *  4. Copy the full console output and share it.
 */

(async function stagDebugV2() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  console.group('%c⚡ STAG Remove-Segment Dropdown Inspector v2', 'color:#f97316;font-size:1.1em;font-weight:bold');

  // ── Step 1: find segment items ─────────────────────────────────────────────
  const list = document.querySelector('[data-automation-id="dynamic-segment-list"]');
  if (!list) {
    console.error('❌ [dynamic-segment-list] not found. Select the module first so the segment panel opens.');
    console.groupEnd(); return;
  }

  const segItems = [...list.querySelectorAll('[data-automation-id^="segment-"]:not([data-automation-id="segment-actions"])')].filter(el => {
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  });

  console.log(`✅ dynamic-segment-list found. Visible segments: ${segItems.length}`);
  segItems.forEach((el, i) =>
    console.log(`  [${i}] data-automation-id="${el.getAttribute('data-automation-id')}"  text="${el.textContent.trim().slice(0,60)}"`)
  );

  if (segItems.length === 0) {
    console.error('❌ No segment items found. Make sure segments have been added to the module.');
    console.groupEnd(); return;
  }

  // ── Step 2: hover the first segment to reveal segment-actions ─────────────
  const firstSeg = segItems[0];
  console.log(`\n🖱 Hovering over: "${firstSeg.getAttribute('data-automation-id')}"`);
  firstSeg.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  firstSeg.dispatchEvent(new MouseEvent('mouseover',  { bubbles: true }));
  await sleep(400);

  // ── Step 3: find and click segment-actions ────────────────────────────────
  const actionsBtn = document.querySelector('[data-automation-id="segment-actions"]');
  if (!actionsBtn) {
    console.error('❌ [segment-actions] button not found after hover. The button may need a real mouse move.');
    console.log('  Trying fallback: looking for any small SVG button near the segment…');

    const nearBtns = [...firstSeg.querySelectorAll('button, [role="button"]'), actionsBtn].filter(Boolean);
    nearBtns.forEach((el, i) =>
      console.log(`  Fallback btn [${i}]: automation-id="${el?.getAttribute('data-automation-id')}"  text="${el?.textContent?.trim()}"  svg=${!!el?.querySelector('svg')}`)
    );
    console.groupEnd(); return;
  }

  const r = actionsBtn.getBoundingClientRect();
  console.log(`✅ segment-actions button found — size: ${Math.round(r.width)}×${Math.round(r.height)}px`);
  console.log('🖱 Clicking segment-actions…');
  actionsBtn.click();
  await sleep(700);

  // ── Step 4: capture everything newly visible in the dropdown ──────────────
  const dropdownEls = [...document.querySelectorAll(
    'li, [role="menuitem"], [role="option"], [role="listitem"], ' +
    '[class*="dropdown"] *, [class*="menu"] *, [class*="popover"] *, [class*="popup"] *'
  )].filter(el => {
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  });

  console.group(`\n📂 Elements visible after clicking segment-actions (${dropdownEls.length} found)`);
  dropdownEls.forEach((el, i) => {
    const txt = el.textContent.trim().slice(0, 80);
    if (!txt) return;
    console.log(
      `  [${i}] <${el.tagName.toLowerCase()}>` +
      `  role="${el.getAttribute('role') || '—'}"` +
      `  automation-id="${el.getAttribute('data-automation-id') || '—'}"` +
      `  class="${el.className?.toString().slice(0,60) || '—'}"` +
      `  text="${txt}"`
    );
  });
  console.groupEnd();

  // ── Step 5: highlight remove candidates ──────────────────────────────────
  const removeKw = ['remove', 'delete', 'detach', 'unlink'];
  const removeCandidates = dropdownEls.filter(el =>
    removeKw.some(k => el.textContent.trim().toLowerCase().includes(k))
  );

  if (removeCandidates.length > 0) {
    console.group('%c🎯 REMOVE candidates found — use these for content.js REMOVE_ITEM', 'color:green;font-weight:bold');
    removeCandidates.forEach(el => {
      console.log({
        tag:          el.tagName.toLowerCase(),
        role:         el.getAttribute('role') || '—',
        automationId: el.getAttribute('data-automation-id') || '—',
        class:        el.className?.toString().slice(0, 100) || '—',
        text:         el.textContent.trim(),
        element:      el,
      });
    });
    console.groupEnd();
  } else {
    console.warn('⚠️ No remove-related items found in dropdown. Full list above — share with developer.');
  }

  // ── Step 6: also dump all data-automation-ids visible right now ───────────
  const newAutoIds = [...document.querySelectorAll('[data-automation-id]')].filter(el => {
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }).map(el => `  automation-id="${el.getAttribute('data-automation-id')}"  <${el.tagName.toLowerCase()}>  "${el.textContent.trim().slice(0,50)}"`);

  console.group(`\n📋 All visible automation-ids right now (${newAutoIds.length})`);
  newAutoIds.forEach(s => console.log(s));
  console.groupEnd();

  // Close menu
  await sleep(200);
  document.body.click();

  console.log('%c\n✅ Done. Share the full output above.', 'color:#f97316;font-weight:bold');
  console.groupEnd();
})();
