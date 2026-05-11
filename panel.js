(() => {
  const params      = new URLSearchParams(location.search);
  const initTabId   = parseInt(params.get('tabId'), 10);
  const initTabUrl  = params.get('tabUrl') || '';
  let   activeTabId = isNaN(initTabId) ? null : initTabId;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const logEl           = document.getElementById('log');
  const clearLogEl      = document.getElementById('clearLog');
  const runBtn          = document.getElementById('runBtn');
  const stopBtn         = document.getElementById('stopBtn');
  const clearLogBtn     = document.getElementById('clearLogBtn');
  const runClearBtn     = document.getElementById('runClearBtn');
  const stopClearBtn    = document.getElementById('stopClearBtn');
  const clearClearLogBtn= document.getElementById('clearClearLogBtn');
  const jsonInput       = document.getElementById('jsonInput');
  const fileInput       = document.getElementById('fileInput');
  const fileName        = document.getElementById('fileName');
  const parsedSummary   = document.getElementById('parsedSummary');
  const progressWrap    = document.getElementById('progressWrap');
  const progressFill    = document.getElementById('progressFill');
  const progressLabel   = document.getElementById('progressLabel');
  const clearProgressWrap  = document.getElementById('clearProgressWrap');
  const clearProgressFill  = document.getElementById('clearProgressFill');
  const clearProgressLabel = document.getElementById('clearProgressLabel');
  const moduleNameEl    = document.getElementById('moduleName');
  const campaignUrlEl   = document.getElementById('campaignUrl');
  const urlBadge        = document.getElementById('urlBadge');
  const urlHint         = document.getElementById('urlHint');
  const tabPaste        = document.getElementById('tabPaste');
  const tabUpload       = document.getElementById('tabUpload');
  const tabExcel        = document.getElementById('tabExcel');
  const pastePanel      = document.getElementById('pastePanel');
  const uploadPanel     = document.getElementById('uploadPanel');
  const excelPanel      = document.getElementById('excelPanel');
  const excelInput      = document.getElementById('excelInput');
  const excelSummary    = document.getElementById('excelSummary');
  const statusPill      = document.getElementById('statusPill');
  const topbarTitle     = document.getElementById('topbarTitle');
  const libCountBadge   = document.getElementById('libCountBadge');
  const statQueue       = document.getElementById('statQueue');
  const statDone        = document.getElementById('statDone');
  const statLibTotal    = document.getElementById('statLibTotal');
  const libSearch       = document.getElementById('libSearch');
  const libTableBody    = document.getElementById('libTableBody');
  const selectAll       = document.getElementById('selectAll');
  const selectedCount   = document.getElementById('selectedCount');
  const applyLibBtn     = document.getElementById('applyLibBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const clearLibBtn     = document.getElementById('clearLibBtn');
  const clearUrlDisplay    = document.getElementById('clearUrlDisplay');
  const clearModuleDisplay = document.getElementById('clearModuleDisplay');
  const dupModal        = document.getElementById('dupModal');
  const dupList         = document.getElementById('dupList');
  const dupCancel       = document.getElementById('dupCancel');
  const dupSkip         = document.getElementById('dupSkip');
  const dupCreate       = document.getElementById('dupCreate');
  const doneModal       = document.getElementById('doneModal');
  const doneModalClose  = document.getElementById('doneModalClose');

  let parsedData    = null;
  let runDoneCount  = 0;
  let isClearMode   = false;

  // ── Segment Library ────────────────────────────────────────────────────────
  let segmentLibrary = [];

  function loadLibrary() {
    return new Promise(resolve => {
      chrome.storage.local.get(['stagLibrary'], result => {
        segmentLibrary = result.stagLibrary || [];
        resolve();
      });
    });
  }

  function saveLibrary() {
    return new Promise(resolve => {
      chrome.storage.local.set({ stagLibrary: segmentLibrary }, resolve);
    });
  }

  async function addToLibrary(entries, campaignUrl) {
    const now = new Date().toISOString();
    for (const e of entries) {
      segmentLibrary.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        name: e['Segment Name'],
        moduleBefore: e['Module Before'] || '',
        moduleAfter: e['Module After'] || '',
        createdAt: now,
        campaign: campaignUrl || '',
      });
    }
    await saveLibrary();
    updateLibUI();
  }

  function updateLibUI() {
    const count = segmentLibrary.length;
    libCountBadge.textContent = count;
    statLibTotal.textContent  = count;
    renderLibrary();
  }

  function findDuplicates(entries) {
    const libNames = new Set(segmentLibrary.map(s => s.name.toLowerCase().trim()));
    return entries.filter(e => libNames.has((e['Segment Name'] || '').toLowerCase().trim()));
  }

  // ── Library render ─────────────────────────────────────────────────────────
  function getFilteredLibrary() {
    const q = libSearch.value.trim().toLowerCase();
    if (!q) return segmentLibrary;
    return segmentLibrary.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.moduleBefore.toLowerCase().includes(q) ||
      s.moduleAfter.toLowerCase().includes(q)
    );
  }

  function renderLibrary() {
    const rows = getFilteredLibrary();

    if (rows.length === 0) {
      libTableBody.innerHTML = `
        <tr><td colspan="5">
          <div class="lib-empty">
            <div class="lib-empty-icon">📭</div>
            <div>${segmentLibrary.length === 0
              ? 'No segments saved yet.<br>Run the automation to populate the library.'
              : 'No segments match your search.'}</div>
          </div>
        </td></tr>`;
      updateSelectionUI();
      return;
    }

    libTableBody.innerHTML = rows.map(s => {
      const date = new Date(s.createdAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      const beforeTag = s.moduleBefore
        ? `<span class="lib-tag">${esc(s.moduleBefore)}</span>`
        : `<span class="lib-tag empty">—</span>`;
      const afterTag = s.moduleAfter
        ? `<span class="lib-tag">${esc(s.moduleAfter)}</span>`
        : `<span class="lib-tag empty">—</span>`;
      return `
        <tr data-id="${s.id}">
          <td><input type="checkbox" class="lib-cb row-cb" data-id="${s.id}" /></td>
          <td><div class="seg-name">${esc(s.name)}</div></td>
          <td>${beforeTag}</td>
          <td>${afterTag}</td>
          <td><span class="seg-meta">${date}</span></td>
        </tr>`;
    }).join('');

    libTableBody.querySelectorAll('.row-cb').forEach(cb => {
      cb.addEventListener('change', updateSelectionUI);
    });

    updateSelectionUI();
  }

  function esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function getSelectedIds() {
    return [...libTableBody.querySelectorAll('.row-cb:checked')].map(cb => cb.dataset.id);
  }

  function updateSelectionUI() {
    const ids = getSelectedIds();
    const total = libTableBody.querySelectorAll('.row-cb').length;
    selectedCount.textContent = `${ids.length} selected`;
    applyLibBtn.disabled      = ids.length === 0;
    deleteSelectedBtn.disabled = ids.length === 0;

    libTableBody.querySelectorAll('tr[data-id]').forEach(tr => {
      const cb = tr.querySelector('.row-cb');
      tr.classList.toggle('sel-row', cb && cb.checked);
    });

    selectAll.indeterminate = ids.length > 0 && ids.length < total;
    selectAll.checked = total > 0 && ids.length === total;
  }

  selectAll.addEventListener('change', () => {
    libTableBody.querySelectorAll('.row-cb').forEach(cb => {
      cb.checked = selectAll.checked;
    });
    updateSelectionUI();
  });

  libSearch.addEventListener('input', () => renderLibrary());

  applyLibBtn.addEventListener('click', () => {
    const ids = getSelectedIds();
    const selected = segmentLibrary.filter(s => ids.includes(s.id));
    if (!selected.length) return;

    parsedData = selected.map(s => ({
      'Segment Name': s.name,
      'Module Before': s.moduleBefore,
      'Module After': s.moduleAfter,
    }));

    jsonInput.value = JSON.stringify(parsedData, null, 2);
    parsedSummary.className = 'ok';
    parsedSummary.textContent = `✅ ${parsedData.length} segment(s) loaded from library.`;
    statQueue.textContent = parsedData.length;

    switchView('run');
    addLog(`📚 Loaded ${parsedData.length} segment(s) from library. Review settings and press Run.`, 'info');
  });

  deleteSelectedBtn.addEventListener('click', () => {
    const ids = new Set(getSelectedIds());
    if (!ids.size) return;
    if (!confirm(`Delete ${ids.size} segment(s) from the library? This cannot be undone.`)) return;
    segmentLibrary = segmentLibrary.filter(s => !ids.has(s.id));
    saveLibrary();
    updateLibUI();
  });

  clearLibBtn.addEventListener('click', () => {
    if (!segmentLibrary.length) return;
    if (!confirm(`Clear all ${segmentLibrary.length} saved segments from the library? This cannot be undone.`)) return;
    segmentLibrary = [];
    saveLibrary();
    updateLibUI();
  });

  // ── Nav switching ──────────────────────────────────────────────────────────
  const views = {
    run:     { el: document.getElementById('viewRun'),     title: 'Run Automation',  nav: document.getElementById('navRun') },
    library: { el: document.getElementById('viewLibrary'), title: 'Segment Library', nav: document.getElementById('navLibrary') },
    clear:   { el: document.getElementById('viewClear'),   title: 'Clear Segments',  nav: document.getElementById('navClear') },
  };

  function switchView(name) {
    Object.entries(views).forEach(([key, v]) => {
      v.el.classList.toggle('active', key === name);
      v.nav.classList.toggle('active', key === name);
    });
    topbarTitle.textContent = views[name].title;

    if (name === 'clear') {
      const url = campaignUrlEl.value.trim();
      const mod = moduleNameEl.value.trim();
      clearUrlDisplay.textContent    = url || '— not set (fill in the Run tab) —';
      clearModuleDisplay.textContent = mod || '— not set (fill in the Run tab) —';
    }
  }

  document.getElementById('navRun').addEventListener('click',     () => switchView('run'));
  document.getElementById('navLibrary').addEventListener('click', () => switchView('library'));
  document.getElementById('navClear').addEventListener('click',   () => switchView('clear'));

  // ── URL badge ──────────────────────────────────────────────────────────────
  const STENSUL_ORIGIN = 'https://samsung.stensul.com';

  function isStensulUrl(url) {
    try { return new URL(url).origin === STENSUL_ORIGIN; }
    catch { return false; }
  }

  function updateUrlBadge() {
    const url = campaignUrlEl.value.trim();
    campaignUrlEl.classList.remove('invalid');

    if (!url) {
      urlBadge.className = 'url-badge required';
      urlBadge.textContent = 'URL required';
      urlHint.className = 'url-hint';
      urlHint.textContent = 'Paste the Stensul campaign edit URL above.';
      return;
    }
    if (!isStensulUrl(url)) {
      urlBadge.className = 'url-badge invalid';
      urlBadge.textContent = 'Invalid URL';
      campaignUrlEl.classList.add('invalid');
      urlHint.className = 'url-hint';
      urlHint.textContent = 'URL must start with https://samsung.stensul.com';
      return;
    }
    const match = activeTabId && initTabUrl &&
      url.split('?')[0] === decodeURIComponent(initTabUrl).split('?')[0];
    if (match) {
      urlBadge.className = 'url-badge open';
      urlBadge.textContent = 'Currently open';
      urlHint.className = 'url-hint';
      urlHint.textContent = 'This tab is already open — the script will inject directly.';
    } else {
      urlBadge.className = 'url-badge new-tab';
      urlBadge.textContent = 'Will open new tab';
      urlHint.className = 'url-hint highlight';
      urlHint.textContent = 'A new tab will be opened and automation will start after page loads.';
    }
  }

  const decodedInitUrl = decodeURIComponent(initTabUrl);
  if (decodedInitUrl && isStensulUrl(decodedInitUrl)) {
    campaignUrlEl.value = decodedInitUrl;
  }
  updateUrlBadge();
  campaignUrlEl.addEventListener('input', updateUrlBadge);

  // ── Input tabs ─────────────────────────────────────────────────────────────
  function setActiveInputTab(tab) {
    [tabPaste, tabUpload, tabExcel].forEach(t => t.classList.remove('active'));
    [pastePanel, uploadPanel, excelPanel].forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    if (tab === tabPaste)  { pastePanel.classList.add('active');  tryParse(jsonInput.value); }
    if (tab === tabUpload) { uploadPanel.classList.add('active'); }
    if (tab === tabExcel)  { excelPanel.classList.add('active');  tryParseExcel(excelInput.value); }
  }

  tabPaste.addEventListener('click',  () => setActiveInputTab(tabPaste));
  tabUpload.addEventListener('click', () => setActiveInputTab(tabUpload));
  tabExcel.addEventListener('click',  () => setActiveInputTab(tabExcel));

  // ── JSON sanitiser / parser ────────────────────────────────────────────────
  function sanitiseJson(text) {
    return text
      .replace(/['']/g, "'").replace(/[""]/g, '"')
      .replace(/[–—]/g, '-').replace(/ /g, ' ')
      .split('\n').map(l => l.trimEnd()).join('\n');
  }

  function friendlyJsonError(rawMsg, text) {
    if (rawMsg.includes('Bad control character')) {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if ((lines[i].trimEnd().match(/"/g) || []).length % 2 !== 0)
          return `Line ${i + 1} has an unclosed string (missing closing "): ${lines[i].trim()}`;
      }
      return 'A string is missing its closing quote ("). Check each value carefully.';
    }
    const lm = rawMsg.match(/line (\d+)/);
    const cm = rawMsg.match(/column (\d+)/);
    const pm = rawMsg.match(/position (\d+)/);
    if (lm && cm) return `Syntax error at line ${lm[1]}, column ${cm[1]}`;
    if (pm)       return `Syntax error near character ${pm[1]}`;
    return rawMsg;
  }

  function tryParse(text) {
    const raw = text.trim();
    if (!raw) {
      parsedData = null;
      parsedSummary.className = '';
      parsedSummary.textContent = 'Ready. Paste JSON or upload a file.';
      statQueue.textContent = 0;
      return;
    }
    const cleaned = sanitiseJson(raw);
    if (cleaned !== raw) jsonInput.value = cleaned;
    try {
      const data = JSON.parse(cleaned);
      if (!Array.isArray(data)) throw new Error('JSON must be an array [ ... ]');
      if (data.length === 0)    throw new Error('Array is empty');
      const required = ['Segment Name', 'Module Before', 'Module After'];
      const missing  = required.filter(k => !Object.prototype.hasOwnProperty.call(data[0], k));
      if (missing.length) throw new Error(`Missing keys in first entry: ${missing.join(', ')}`);
      parsedData = data;
      parsedSummary.className = 'ok';
      parsedSummary.textContent = `✅ ${data.length} segment${data.length === 1 ? '' : 's'} ready to assign.`;
      statQueue.textContent = data.length;
    } catch (e) {
      parsedData = null;
      statQueue.textContent = 0;
      parsedSummary.className = 'err';
      const hint = e instanceof SyntaxError ? friendlyJsonError(e.message, cleaned) : e.message;
      parsedSummary.textContent = `❌ ${hint}`;
    }
  }

  jsonInput.addEventListener('input', () => tryParse(jsonInput.value));

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    fileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = e => { jsonInput.value = e.target.result; tryParse(e.target.result); };
    reader.readAsText(file);
  });

  // ── Excel / TSV paste parser ───────────────────────────────────────────────

  function parseExcelPaste(text) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('Need at least a header row and one data row.');

    const headers = lines[0].split('\t').map(h => h.trim());
    const keyMap  = {};

    headers.forEach((h, i) => {
      const hl = h.toLowerCase().replace(/[^a-z ]/g, '').trim();
      if (['segment name', 'segmentname', 'segment', 'name'].includes(hl))
        keyMap['Segment Name'] = i;
      else if (['module before', 'modulebefore', 'before', 'code before', 'codebefore'].includes(hl))
        keyMap['Module Before'] = i;
      else if (['module after', 'moduleafter', 'after', 'code after', 'codeafter'].includes(hl))
        keyMap['Module After'] = i;
    });

    const missing = ['Segment Name', 'Module Before', 'Module After'].filter(k => !(k in keyMap));
    if (missing.length) {
      const found = headers.join(', ') || '(none)';
      throw new Error(`Cannot map columns — missing: ${missing.join(', ')}. Headers found: ${found}`);
    }

    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      if (cols.every(c => !c.trim())) continue;
      result.push({
        'Segment Name':  (cols[keyMap['Segment Name']]  || '').trim(),
        'Module Before': (cols[keyMap['Module Before']] || '').trim(),
        'Module After':  (cols[keyMap['Module After']]  || '').trim(),
      });
    }

    if (!result.length) throw new Error('No data rows found after the header row.');
    return result;
  }

  function tryParseExcel(text) {
    const raw = text.trim();
    if (!raw) {
      parsedData = null;
      excelSummary.className = '';
      excelSummary.textContent = 'Paste Excel data above (copy cells including the header row from Excel).';
      statQueue.textContent = 0;
      return;
    }
    try {
      const data = parseExcelPaste(raw);
      parsedData = data;
      excelSummary.className = 'ok';
      excelSummary.textContent = `✅ ${data.length} segment${data.length === 1 ? '' : 's'} parsed from Excel.`;
      statQueue.textContent = data.length;
      // Mirror to JSON tab for reference
      jsonInput.value = JSON.stringify(data, null, 2);
      parsedSummary.className = 'ok';
      parsedSummary.textContent = `✅ ${data.length} segment(s) converted from Excel.`;
    } catch (e) {
      parsedData = null;
      statQueue.textContent = 0;
      excelSummary.className = 'err';
      excelSummary.textContent = `❌ ${e.message}`;
    }
  }

  excelInput.addEventListener('input', () => tryParseExcel(excelInput.value));

  // ── Logging ────────────────────────────────────────────────────────────────
  function addLog(message, type = 'info', target = logEl) {
    const span = document.createElement('span');
    span.className = `log-${type}`;
    span.textContent = message + '\n';
    target.appendChild(span);
    target.scrollTop = target.scrollHeight;
  }

  function setProgress(done, total, el = progressWrap, fill = progressFill, lbl = progressLabel) {
    el.style.display = 'block';
    fill.style.width = (total > 0 ? (done / total) * 100 : 0) + '%';
    lbl.textContent = `${done} / ${total}`;
  }

  function setStatus(text, cls = '') {
    statusPill.textContent = text;
    statusPill.className = 'status-pill' + (cls ? ' ' + cls : '');
  }

  function resetRunUI(running) {
    runBtn.disabled  =  running;
    stopBtn.disabled = !running;
    if (!running) setStatus('Ready');
  }

  function resetClearUI(running) {
    runClearBtn.disabled  =  running;
    stopClearBtn.disabled = !running;
    if (!running) setStatus('Ready');
  }

  // ── Completion modal ───────────────────────────────────────────────────────

  function showDoneModal({ mode = 'create', count = 0 } = {}) {
    const icon  = document.getElementById('doneModalIcon');
    const title = document.getElementById('doneModalTitle');
    const countEl = document.getElementById('doneModalCount');
    const body  = document.getElementById('doneModalBody');

    if (mode === 'clear-none') {
      icon.textContent  = 'ℹ️';
      title.textContent = 'No Segments to Clear';
      countEl.textContent = '';
      body.innerHTML    = 'No segments were found on this module.<br>Nothing to remove.';
    } else if (mode === 'clear') {
      icon.textContent  = '🗑️';
      title.textContent = 'Segments Cleared!';
      countEl.textContent = `${count} segment${count === 1 ? '' : 's'} cleared.`;
      body.innerHTML    = 'All segments have been successfully removed.<br>Please review the module in Stensul before publishing.';
    } else {
      icon.textContent  = '✅';
      title.textContent = 'All Segments Created!';
      countEl.textContent = count > 0 ? `${count} segment${count === 1 ? '' : 's'} created.` : 'All segments created.';
      body.innerHTML    = 'All segments have been successfully created.<br>Please review them in Stensul before publishing.';
    }

    doneModal.classList.add('open');
  }

  doneModalClose.addEventListener('click', () => doneModal.classList.remove('open'));

  // Close on overlay click
  doneModal.addEventListener('click', e => {
    if (e.target === doneModal) doneModal.classList.remove('open');
  });

  // ── Validate Stensul page before run ──────────────────────────────────────

  function validateStensulPage(tabId) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(onResult);
        resolve([]); // don't block the run if validation times out
      }, 10000);

      function onResult(msg) {
        if (msg.action !== 'validateResult') return;
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(onResult);
        resolve(msg.errors || []);
      }

      chrome.runtime.onMessage.addListener(onResult);
      chrome.tabs.sendMessage(tabId, { action: 'validate' }).catch(() => {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(onResult);
        resolve([]);
      });
    });
  }

  // ── Message relay from content script ─────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'log') {
      const target = isClearMode ? clearLogEl : logEl;
      addLog(msg.message, msg.type || 'info', target);
    }
    else if (msg.action === 'progress') {
      if (isClearMode) {
        clearProgressWrap.style.display = 'block';
        clearProgressFill.style.width = '100%';
        clearProgressLabel.textContent = `${msg.done} removed`;
      } else {
        setProgress(msg.done, msg.total);
        statDone.textContent = msg.done;
        runDoneCount = msg.done;
      }
    }
    else if (msg.action === 'done') {
      if (isClearMode) {
        const removed = msg.removed ?? 0;
        if (removed > 0) {
          addLog(`🎉 Clear complete — ${removed} segment${removed === 1 ? '' : 's'} removed.`, 'success', clearLogEl);
          showDoneModal({ mode: 'clear', count: removed });
        } else {
          addLog('ℹ️ No segments were found to clear.', 'info', clearLogEl);
          showDoneModal({ mode: 'clear-none' });
        }
        resetClearUI(false);
        isClearMode = false;
      } else {
        addLog('🎉 All done!', 'success', logEl);
        resetRunUI(false);
        showDoneModal({ mode: 'create', count: runDoneCount });
      }
    }
    else if (msg.action === 'error') {
      const target = isClearMode ? clearLogEl : logEl;
      addLog(`❌ Fatal: ${msg.message}`, 'error', target);
      if (isClearMode) { resetClearUI(false); isClearMode = false; }
      else             resetRunUI(false);
      setStatus('Error', 'error');
    }
    else if (msg.action === 'segmentSaved') {
      const entry = msg.entry;
      if (entry) addToLibrary([entry], campaignUrlEl.value.trim());
    }
  });

  // ── Open a URL in a new tab ────────────────────────────────────────────────
  function openTabAndWait(url) {
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url, active: true }, (tab) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        const newId = tab.id;
        const onUpdated = (tabId, changeInfo) => {
          if (tabId !== newId || changeInfo.status !== 'complete') return;
          chrome.tabs.onUpdated.removeListener(onUpdated);
          setTimeout(() => resolve(newId), 2500);
        };
        chrome.tabs.onUpdated.addListener(onUpdated);
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          reject(new Error('Tab took too long to load (30s). Check the URL and try again.'));
        }, 30000);
      });
    });
  }

  async function resolveTabId(campaignUrl) {
    const urlBase = campaignUrl.split('?')[0];
    if (activeTabId) {
      try {
        const tab = await chrome.tabs.get(activeTabId);
        if (tab.url && tab.url.split('?')[0] === urlBase) return activeTabId;
      } catch { /* tab closed */ }
    }
    addLog(`🌐 Opening ${campaignUrl} …`, 'info');
    const newId = await openTabAndWait(campaignUrl);
    addLog(`✅ Page ready — starting…`, 'success');
    activeTabId = newId;
    return newId;
  }

  // ── Duplicate check + run flow ─────────────────────────────────────────────
  function showDupModal(dupes, onSkip, onCreate, onCancel) {
    dupList.innerHTML = dupes.map(e => `<li>${esc(e['Segment Name'])}</li>`).join('');
    dupModal.classList.add('open');

    const cleanup = () => {
      dupModal.classList.remove('open');
      dupSkip.onclick = dupCreate.onclick = dupCancel.onclick = null;
    };

    dupSkip.onclick = () => { cleanup(); onSkip(); };
    dupCreate.onclick = () => { cleanup(); onCreate(); };
    dupCancel.onclick = () => { cleanup(); onCancel(); };
  }

  async function startRun(entries) {
    const campaignUrl = campaignUrlEl.value.trim();
    const moduleName  = moduleNameEl.value.trim();

    isClearMode = false;
    resetRunUI(true);
    setStatus('Running', 'running');
    logEl.innerHTML = '';
    progressWrap.style.display = 'none';
    progressFill.style.width = '0%';
    runDoneCount = 0;
    statDone.textContent = 0;

    addLog(`▶ Starting — ${entries.length} segment(s) on module "${moduleName}"`, 'info');

    try {
      const targetTabId = await resolveTabId(campaignUrl);
      await chrome.scripting.executeScript({ target: { tabId: targetTabId }, files: ['content.js'] });

      // Validate the Stensul page before running
      addLog('🔍 Validating Stensul page…', 'info');
      const validationErrors = await validateStensulPage(targetTabId);
      if (validationErrors.length > 0) {
        validationErrors.forEach(e => addLog(`❌ ${e}`, 'error'));
        resetRunUI(false);
        setStatus('Error', 'error');
        return;
      }
      addLog('✅ Page validation passed — launching automation', 'success');

      await chrome.tabs.sendMessage(targetTabId, { action: 'start', moduleName, entries });
    } catch (err) {
      addLog(`❌ ${err.message}`, 'error');
      resetRunUI(false);
      setStatus('Error', 'error');
    }
  }

  runBtn.addEventListener('click', async () => {
    const campaignUrl = campaignUrlEl.value.trim();
    const moduleName  = moduleNameEl.value.trim();

    if (!campaignUrl || !isStensulUrl(campaignUrl)) {
      addLog('⚠️ Enter a valid samsung.stensul.com campaign URL first.', 'warn'); return;
    }
    if (!moduleName) {
      addLog('⚠️ Module name is required.', 'warn'); return;
    }
    if (!parsedData) {
      addLog('⚠️ No valid segment data loaded — paste JSON, upload a file, or paste from Excel first.', 'warn'); return;
    }

    const dupes = findDuplicates(parsedData);
    if (dupes.length > 0) {
      showDupModal(
        dupes,
        () => {
          const libNames = new Set(segmentLibrary.map(s => s.name.toLowerCase().trim()));
          const filtered = parsedData.filter(e => !libNames.has(e['Segment Name'].toLowerCase().trim()));
          if (!filtered.length) {
            addLog('⚠️ All segments already exist in library — nothing to create.', 'warn'); return;
          }
          addLog(`ℹ️ Skipping ${dupes.length} duplicate(s) — running ${filtered.length} new segment(s).`, 'info');
          startRun(filtered);
        },
        () => startRun(parsedData),
        () => addLog('ℹ️ Run cancelled.', 'dim')
      );
    } else {
      startRun(parsedData);
    }
  });

  stopBtn.addEventListener('click', () => {
    if (activeTabId) chrome.tabs.sendMessage(activeTabId, { action: 'stop' }).catch(() => {});
    addLog('⏹ Stop requested…', 'warn');
    resetRunUI(false);
    setStatus('Stopped', 'warn');
  });

  clearLogBtn.addEventListener('click', () => {
    logEl.innerHTML = '<span class="log-dim">Log cleared.</span>';
  });

  // ── Clear segments script ──────────────────────────────────────────────────
  runClearBtn.addEventListener('click', async () => {
    const campaignUrl = campaignUrlEl.value.trim();
    const moduleName  = moduleNameEl.value.trim();

    if (!campaignUrl || !isStensulUrl(campaignUrl)) {
      addLog('⚠️ Campaign URL not set. Fill it in the Run tab first.', 'warn', clearLogEl); return;
    }
    if (!moduleName) {
      addLog('⚠️ Module name not set. Fill it in the Run tab first.', 'warn', clearLogEl); return;
    }
    if (!confirm(`Remove ALL segments from module "${moduleName}"? This cannot be undone.`)) return;

    isClearMode = true;
    resetClearUI(true);
    setStatus('Clearing', 'running');
    clearLogEl.innerHTML = '';
    clearProgressWrap.style.display = 'none';

    addLog(`🗑 Starting clear script for module "${moduleName}"…`, 'info', clearLogEl);

    try {
      const targetTabId = await resolveTabId(campaignUrl);
      await chrome.scripting.executeScript({ target: { tabId: targetTabId }, files: ['content.js'] });
      await chrome.tabs.sendMessage(targetTabId, { action: 'clear', moduleName });
    } catch (err) {
      addLog(`❌ ${err.message}`, 'error', clearLogEl);
      resetClearUI(false);
      setStatus('Error', 'error');
      isClearMode = false;
    }
  });

  stopClearBtn.addEventListener('click', () => {
    if (activeTabId) chrome.tabs.sendMessage(activeTabId, { action: 'stop' }).catch(() => {});
    addLog('⏹ Stop requested…', 'warn', clearLogEl);
    resetClearUI(false);
    setStatus('Stopped', 'warn');
    isClearMode = false;
  });

  clearClearLogBtn.addEventListener('click', () => {
    clearLogEl.innerHTML = '<span class="log-dim">Log cleared.</span>';
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  loadLibrary().then(() => updateLibUI());

})();
