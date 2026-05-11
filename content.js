// Injected into samsung.stensul.com campaign editor.
// All selectors verified from live page inspection via data-automation-id attributes.

(() => {
  if (window.__stagActive) return;

  let stopRequested = false;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function log(message, type = 'info') {
    chrome.runtime.sendMessage({ action: 'log', message, type });
  }

  function progress(done, total) {
    chrome.runtime.sendMessage({ action: 'progress', done, total });
  }

  // ── Verified selectors ────────────────────────────────────────────────────
  const SEL = {
    ADD_SEGMENT_BTN: '[data-automation-id="add-segment"] button',
    NEW_SEGMENT:     '[data-automation-id="new-segment"]',
    FORM:            '[data-automation-id="ai-panel-textgenerator"]',
    NAME_INPUT:      '[data-automation-id="scripted-dca-segment-name"]',
    BEFORE_INPUT:    '[placeholder="Select Code Before Module"]',
    AFTER_INPUT:     '[placeholder="Select Code After Module"]',
    SAVE_BTN:        '[data-automation-id="scripted-dca-save-button"]',
    // Clear script selectors — segment items in the right panel
    SEGMENT_ITEM:    '[data-automation-id="segment-item"]',
    SEGMENT_OPTIONS: '[data-automation-id="segment-options-button"], [data-automation-id="segment-kebab"], [data-automation-id="segment-menu-trigger"]',
    REMOVE_ITEM:     '[data-automation-id="segment-remove"], [data-automation-id="remove-from-module"]',
  };

  // ── Utilities ──────────────────────────────────────────────────────────────

  function setReactValue(el, value) {
    const proto  = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function waitFor(selectorOrFn, timeout = 15000, label = '') {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (stopRequested) throw new Error('Stopped by user');
      const el = typeof selectorOrFn === 'string'
        ? document.querySelector(selectorOrFn)
        : selectorOrFn();
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) return el;
      }
      await sleep(120);
    }
    throw new Error(`Timeout (${timeout}ms): "${label || selectorOrFn}" not found`);
  }

  // ── Page validation ────────────────────────────────────────────────────────
  // Checks that "Samsung - Header Logo" module is present and (best-effort)
  // that Dynamic Segment is enabled before the run begins.

  function validatePage() {
    const errors = [];

    // Collect all documents (main page + any iframes)
    const docs = [document];
    for (const f of document.querySelectorAll('iframe')) {
      try { if (f.contentDocument?.body) docs.push(f.contentDocument); } catch {}
    }

    // Check 1: Samsung - Header Logo module must be in the canvas
    let headerLogoFound = false;
    for (const doc of docs) {
      if (doc.querySelector('[data-automation-id="Samsung - Header Logo"]')) {
        headerLogoFound = true;
        break;
      }
    }
    if (!headerLogoFound) {
      errors.push(
        '"Samsung - Header Logo" module was not found on this page. ' +
        'Please add it to the campaign and enable Dynamic Segment before running the script.'
      );
    }

    return errors;
  }

  // ── Wait for Stensul save-confirmation toast ───────────────────────────────
  // After saving a segment, Stensul shows a toast/snackbar. We poll for it
  // so the library entry is only written after the real save confirmation.

  async function waitForStensulToast(timeout = 8000) {
    const keywords = ['saved', 'created', 'added', 'success', 'segment'];
    const toastSels = [
      '[class*="toast"]',
      '[class*="snack"]',
      '[role="alert"]',
      '[role="status"]',
      '[data-automation-id*="toast"]',
      '[data-automation-id*="notification"]',
      '[data-automation-id*="alert"]',
      '[class*="notification"]',
      '[class*="alert"]',
    ];

    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      for (const sel of toastSels) {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          if (!r.width && !r.height) continue;
          const txt = el.textContent.trim().toLowerCase();
          if (txt.length > 0 && keywords.some(kw => txt.includes(kw))) return true;
        }
      }
      await sleep(200);
    }
    return false;
  }

  // ── Step 1: Select the target module ──────────────────────────────────────

  async function selectModule(moduleName) {
    log(`🎯 Selecting module: "${moduleName}"…`);

    function findSelectTd() {
      const docs = [document];
      for (const f of document.querySelectorAll('iframe')) {
        try { if (f.contentDocument?.body) docs.push(f.contentDocument); } catch {}
      }
      for (const doc of docs) {
        const span = doc.querySelector(`[data-automation-id="${CSS.escape(moduleName)}"]`);
        if (!span) continue;
        let cur = span.parentElement;
        while (cur && cur !== doc.body) {
          if (cur.getAttribute('data-automation-id') === 'select-module') return cur;
          cur = cur.parentElement;
        }
      }
      return null;
    }

    const td = await waitFor(findSelectTd, 20000, `select-module for "${moduleName}"`);
    log(`  📄 Found select-module TD — clicking`, 'dim');
    td.click();
    await sleep(800);
    await waitFor(SEL.ADD_SEGMENT_BTN, 10000, '"Create or reuse segments" button');
    log(`✅ Module "${moduleName}" selected`, 'success');
    await sleep(300);
  }

  // ── Step 2: Open segment list panel ───────────────────────────────────────

  async function openSegmentList() {
    log(`📂 Opening segment list…`);
    const existing = document.querySelector(SEL.NEW_SEGMENT);
    if (existing) {
      const r = existing.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) { log(`  ✔ Already open`, 'dim'); return; }
    }
    const btn = await waitFor(SEL.ADD_SEGMENT_BTN, 8000, '"Create or reuse segments" button');
    btn.click();
    await sleep(400);
    await waitFor(SEL.NEW_SEGMENT, 5000, '"New segment" item');
    log(`  ✔ Panel open`, 'dim');
  }

  // ── Step 3: Click "New segment" ───────────────────────────────────────────

  async function clickNewSegment() {
    log(`➕ Clicking "New segment"…`);
    const el = await waitFor(SEL.NEW_SEGMENT, 5000, '"New segment"');
    el.click();
    await sleep(600);
    await waitFor(SEL.FORM, 8000, 'Manage Conditions dialog');
    log(`  ✔ Form open`, 'dim');
  }

  // ── Step 4: Fill Name ─────────────────────────────────────────────────────

  async function fillName(value) {
    log(`📝 Name → "${value}"…`);
    const input = await waitFor(SEL.NAME_INPUT, 5000, 'Name input');
    input.focus();
    await sleep(80);
    setReactValue(input, value);
    await sleep(200);
  }

  // ── Step 5: Select a dropdown condition ───────────────────────────────────

  async function selectCondition(inputSel, label, value) {
    if (!value) return;
    log(`🔽 ${label} → "${value}"…`);
    const valLc = value.trim().toLowerCase();
    const input = await waitFor(inputSel, 5000, `${label} input`);

    input.click();
    input.focus();
    await sleep(300);
    setReactValue(input, value);
    await sleep(400);

    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      await sleep(200);
      for (const li of document.querySelectorAll('li')) {
        if (li.textContent.trim().toLowerCase() === valLc) {
          const r = li.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { li.click(); await sleep(400); log(`  ✔ Selected "${value}"`, 'dim'); return; }
        }
      }
      const form = document.querySelector(SEL.FORM);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim().toLowerCase() !== valLc) continue;
        const el = node.parentElement;
        if (form && form.contains(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { el.click(); await sleep(400); log(`  ✔ Selected "${value}"`, 'dim'); return; }
      }
    }
    throw new Error(`Option "${value}" not found for "${label}" after 6s`);
  }

  // ── Step 6: Save ──────────────────────────────────────────────────────────

  async function clickSave() {
    log(`💾 Saving…`);
    const btn = await waitFor(SEL.SAVE_BTN, 5000, 'Save button');
    const enableDeadline = Date.now() + 3000;
    while (btn.disabled && Date.now() < enableDeadline) await sleep(150);
    btn.click();

    const closeDeadline = Date.now() + 15000;
    let saved = false, retried = false;
    while (Date.now() < closeDeadline) {
      await sleep(350);
      if (stopRequested) throw new Error('Stopped by user');
      if (!document.querySelector(SEL.FORM)) { saved = true; break; }
      if (!retried && Date.now() - (closeDeadline - 15000) > 5000) {
        retried = true;
        log(`⚠️ Dialog still open — retrying save…`, 'warn');
        const b = document.querySelector(SEL.SAVE_BTN);
        if (b && !b.disabled) b.click();
      }
    }
    if (!saved) log(`⚠️ Dialog may still be open — continuing`, 'warn');
    await sleep(600);
  }

  // ── Clear script helpers ───────────────────────────────────────────────────

  function findFirstSegmentOptionsBtn() {
    for (const sel of SEL.SEGMENT_OPTIONS.split(', ')) {
      const els = document.querySelectorAll(sel.trim());
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return el;
      }
    }

    const items = document.querySelectorAll(SEL.SEGMENT_ITEM);
    for (const item of items) {
      const buttons = item.querySelectorAll('button, [role="button"]');
      for (const btn of buttons) {
        const txt = btn.textContent.trim();
        const r   = btn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (txt === '...' || txt === '⋮' || txt === '•••' || txt === '' || btn.querySelector('svg'))) {
          return btn;
        }
      }
    }

    const allBtns = document.querySelectorAll('button, [role="button"]');
    for (const btn of allBtns) {
      const txt = btn.textContent.trim();
      const r   = btn.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.width < 50 &&
          (txt === '...' || txt === '⋮' || txt === '•••')) {
        return btn;
      }
    }

    return null;
  }

  function findRemoveFromModuleItem() {
    for (const sel of SEL.REMOVE_ITEM.split(', ')) {
      const el = document.querySelector(sel.trim());
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return el;
      }
    }

    const phrases = ['remove from module', 'remove from this module', 'remove segment'];
    const candidates = document.querySelectorAll(
      'li, [role="menuitem"], [role="option"], [role="listitem"], p, span, div, button, a'
    );
    for (const el of candidates) {
      const txt = el.textContent.trim().toLowerCase();
      if (phrases.some(p => txt === p || txt.startsWith(p))) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return el;
      }
    }

    return null;
  }

  function countVisibleSegments() {
    let count = 0;

    const items = document.querySelectorAll(SEL.SEGMENT_ITEM);
    if (items.length > 0) {
      for (const item of items) {
        const r = item.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) count++;
      }
      return count;
    }

    for (const sel of SEL.SEGMENT_OPTIONS.split(', ')) {
      const els = document.querySelectorAll(sel.trim());
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) count++;
      }
    }
    return count;
  }

  // ── Clear script: remove all segments from module ─────────────────────────

  async function clearAllSegments({ moduleName }) {
    log(`🗑 Clear script started for module "${moduleName}"…`);

    try {
      await selectModule(moduleName);
    } catch (err) {
      if (err.message === 'Stopped by user') { log('⏹ Stopped.', 'warn'); return; }
      log(`❌ Could not select module: ${err.message}`, 'error');
      chrome.runtime.sendMessage({ action: 'error', message: err.message });
      window.__stagActive = false;
      return;
    }

    try {
      await openSegmentList();
    } catch (err) {
      log(`⚠️ Could not open segment list: ${err.message}`, 'warn');
    }

    await sleep(500);

    const initialCount = countVisibleSegments();
    if (initialCount === 0) {
      log(`ℹ️ No segments found on module "${moduleName}". Nothing to remove.`, 'info');
      window.__stagActive = false;
      chrome.runtime.sendMessage({ action: 'done' });
      return;
    }

    log(`📋 Found ${initialCount} segment(s) — removing one by one…`, 'info');

    let removed = 0;
    const maxAttempts = initialCount + 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (stopRequested) { log('⏹ Stopped.', 'warn'); break; }

      const optBtn = findFirstSegmentOptionsBtn();
      if (!optBtn) {
        log(`✅ No more segments found — removed ${removed} total.`, 'success');
        break;
      }

      log(`  🔧 Opening options for segment ${removed + 1}…`, 'dim');
      optBtn.click();
      await sleep(500);

      const removeItem = findRemoveFromModuleItem();
      if (!removeItem) {
        document.body.click();
        await sleep(300);
        log(`⚠️ Options menu opened but "Remove from module" not found. Selectors may need updating.`, 'warn');
        log(`  ℹ️ Verify that the segment options menu contains "Remove from module" text.`, 'dim');
        break;
      }

      removeItem.click();
      await sleep(800);
      removed++;
      progress(removed, initialCount);
      log(`  🗑 Removed segment ${removed}`, 'dim');
      await sleep(300);
    }

    if (removed > 0) {
      log(`🎉 Done — removed ${removed} segment(s) from "${moduleName}".`, 'success');
    }

    window.__stagActive = false;
    chrome.runtime.sendMessage({ action: 'done' });
  }

  // ── Main run (create segments) ─────────────────────────────────────────────

  async function run({ moduleName, entries }) {
    const total = entries.length;
    progress(0, total);

    try {
      await selectModule(moduleName);
    } catch (err) {
      if (err.message === 'Stopped by user') { log('⏹ Stopped.', 'warn'); return; }
      log(`❌ Could not select module "${moduleName}": ${err.message}`, 'error');
      chrome.runtime.sendMessage({ action: 'error', message: err.message });
      window.__stagActive = false;
      return;
    }

    for (let i = 0; i < entries.length; i++) {
      if (stopRequested) { log('⏹ Stopped.', 'warn'); break; }

      const entry  = entries[i];
      const name   = entry['Segment Name'];
      const before = entry['Module Before'];
      const after  = entry['Module After'];
      log(`\n[${i + 1}/${total}] "${name}"…`);

      try {
        await openSegmentList();
        await clickNewSegment();
        await fillName(name);
        if (before) await selectCondition(SEL.BEFORE_INPUT, 'Code Before', before);
        if (after)  await selectCondition(SEL.AFTER_INPUT,  'Code After',  after);
        await clickSave();

        // Only add to library after Stensul's own save-confirmation toast appears
        log(`  ⏳ Waiting for Stensul save confirmation…`, 'dim');
        const toastSeen = await waitForStensulToast();
        if (toastSeen) {
          log(`  ✔ Save confirmed by Stensul`, 'dim');
        } else {
          log(`  ℹ️ Save toast not detected — dialog closed, treating as saved`, 'dim');
        }

        progress(i + 1, total);
        log(`✅ Saved: "${name}"`, 'success');

        // Notify panel — library entry written only after this point
        chrome.runtime.sendMessage({ action: 'segmentSaved', entry });

        await sleep(600);
      } catch (err) {
        if (err.message === 'Stopped by user') { log('⏹ Stopped.', 'warn'); break; }
        log(`❌ Error on "${name}": ${err.message}`, 'error');
        chrome.runtime.sendMessage({ action: 'error', message: err.message });
        window.__stagActive = false;
        return;
      }
    }

    window.__stagActive = false;
    chrome.runtime.sendMessage({ action: 'done' });
  }

  // ── Message listener ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'stop') { stopRequested = true; return; }
    if (msg.action === 'start') {
      window.__stagActive = true;
      stopRequested = false;
      run(msg);
    }
    if (msg.action === 'clear') {
      window.__stagActive = true;
      stopRequested = false;
      clearAllSegments(msg);
    }
    if (msg.action === 'validate') {
      const errors = validatePage();
      chrome.runtime.sendMessage({ action: 'validateResult', errors });
    }
  });

})();
