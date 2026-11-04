// To Do List for CrossPoint — File Manager plugin.
// Notes are plain .txt files in /Notes, so the reader opens them with its
// built-in TXT reader (RTL text such as Arabic included).
//
// Sleep wallpaper: plugins cannot run code on the reader itself, so this card
// renders notes into sleep-screen bitmaps in the browser. Nothing is written
// when the page opens: pressing "Save to reader" saves the note and (if the
// box is ticked) saves it as /sleep/note.bmp (24-bit uncompressed BMP, the format CrossPoint's Custom sleep
// screen expects). Any .bmp already in /sleep is deleted first, so the note is
// the only image there, along with CrossPoint's own cached sleep images
// (/.crosspoint/*sleep*.bmp). Any note can also be set by hand.
//
// Prefill: open the page with the note in the URL fragment and the card fills
// itself in, ready for "Save to reader". The fragment never reaches the reader,
// so long notes are fine:
//   http://crosspoint.local/files#note=<URL-encoded text>   (first line = title)
//   http://crosspoint.local/files#title=<...>&body=<...>
//
// Device endpoints used (same-origin):
//   GET /api/files?path=   GET /download?path=   POST /upload?path=
//   POST /mkdir   POST /delete
CrossPoint.registerPlugin((container, api) => {
  const DIR = '/Notes';
  const SLEEP_DIR = '/sleep';
  const WALLPAPER = 'note.bmp';
  const KEY_WALL = 'cpn-wall:/sleep/note.bmp';
  const CACHE_DIR = '/.crosspoint';
  const SIZES = { X3: [528, 792], X4: [480, 800] };
  const KEY_MODEL = 'cpn-model';
  const KEY_AUTO = 'cpn-auto';

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  container.innerHTML = `
    <style>
      .cpn { font: inherit; }
      .cpn h2 { margin: 0 0 .5rem; }
      .cpn input[type=text], .cpn textarea { width: 100%; box-sizing: border-box; font: inherit;
        padding: .5rem; margin-bottom: .5rem; border: 1px solid #999; border-radius: 6px; }
      .cpn textarea { min-height: 8rem; }
      .cpn button, .cpn select { font: inherit; padding: .4rem .8rem; border-radius: 6px;
        border: 1px solid #555; background: none; cursor: pointer; }
      .cpn .row { display: flex; justify-content: space-between; align-items: center;
        gap: .5rem; padding: .4rem 0; border-bottom: 1px solid #ddd; }
      .cpn .row div { display: flex; gap: .4rem; flex-shrink: 0; }
      .cpn .name { overflow-wrap: anywhere; }
      .cpn .muted { opacity: .7; font-size: .9em; }
      .cpn .cpn-block { display: block; }
      .cpn .cpn-status { margin-top: .5rem; min-height: 1.4em; overflow-wrap: anywhere; }
      .cpn button:disabled { opacity: .5; cursor: default; }
      .cpn .opts { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin: .75rem 0; }
      .cpn canvas { display: block; width: 132px; border: 1px solid #999; margin-top: .5rem; }
    </style>
    <div class="cpn">
      <h2>To Do List</h2>
      <p class="muted">Notes are saved as text files in ${DIR}. Open them on the reader from the Library.</p>
      <input type="text" id="cpn-title" placeholder="Title (optional)" maxlength="60">
      <textarea id="cpn-body" placeholder="Write a note…" dir="auto"></textarea>
      <button id="cpn-save" class="cpn-block">Save to reader</button>
      <div id="cpn-status" class="muted cpn-status" role="status" aria-live="polite"></div>

      <h3>Sleep wallpaper</h3>
      <p class="muted">When you press Save to reader, the note is also saved as ${SLEEP_DIR}/${WALLPAPER}.
        Any other .bmp files in ${SLEEP_DIR}, and cached sleep images in ${CACHE_DIR}, are deleted first.
        On the reader, set Settings → Display → Sleep Screen → Custom.</p>
      <div class="opts">
        <label><input type="checkbox" id="cpn-auto"> Also set as sleep wallpaper when saving</label>
        <label>Device <select id="cpn-model"><option>X3</option><option>X4</option></select></label>
      </div>
      <canvas id="cpn-preview" hidden></canvas>

      <h3>Saved notes</h3>
      <div id="cpn-list" class="muted">Loading…</div>
    </div>`;

  const $ = (id) => container.querySelector('#' + id);
  const status = (msg) => { $('cpn-status').textContent = msg; };
  const esc = (s) => s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const form = (fields) => new URLSearchParams(fields).toString();

  $('cpn-auto').checked = store.get(KEY_AUTO, '1') === '1';
  $('cpn-model').value = store.get(KEY_MODEL, 'X3');
  $('cpn-auto').onchange = (e) => store.set(KEY_AUTO, e.target.checked ? '1' : '0');
  $('cpn-model').onchange = (e) => store.set(KEY_MODEL, e.target.value);

  // ---------- file helpers ----------

  function stamp() {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function safeName(title, body) {
    let t = (title || body.split('\n').find((l) => l.trim()) || 'Note').trim();
    t = t.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/^\.+/, '').slice(0, 50).trim();
    return `${stamp()} ${t || 'Note'}.txt`;
  }

  async function ensureFolder(path) {
    const name = path.replace(/^\//, '');
    const r = await fetch('/api/files?path=/');
    if (!r.ok) throw new Error('Could not read the SD card');
    const items = await r.json();
    if (items.some((i) => i.isDirectory && i.name === name)) return;
    const m = await fetch('/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ name, path: '/' }),
    });
    if (!m.ok && !(await m.text()).includes('already exists')) {
      throw new Error('Could not create ' + path);
    }
  }

  // Fast path: the reader's WebSocket upload on port 81
  //   START:<filename>:<size>:<path> -> READY -> binary chunks -> PROGRESS:a:b -> DONE | ERROR:msg
  function uploadWs(dir, name, blob, onProgress) {
    return new Promise(async (resolve, reject) => {
      let ws, settled = false;
      const done = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { ws.close(); } catch (e) { /* ignore */ }
        err ? reject(err) : resolve();
      };
      const timer = setTimeout(() => done(new Error('WebSocket timed out')), 120000);
      try {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        ws = new WebSocket(`ws://${location.hostname}:81/`);
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => ws.send(`START:${name}:${bytes.length}:${dir}`);
        ws.onerror = () => done(new Error('WebSocket error'));
        ws.onclose = () => done(new Error('WebSocket closed early'));
        ws.onmessage = async (ev) => {
          const msg = String(ev.data);
          if (msg === 'READY') {
            const CHUNK = 4096;
            for (let i = 0; i < bytes.length; i += CHUNK) {
              while (ws.bufferedAmount > 64 * 1024) await new Promise((r) => setTimeout(r, 20));
              if (settled) return;
              ws.send(bytes.subarray(i, i + CHUNK));
            }
          } else if (msg.startsWith('PROGRESS:')) {
            const [, a, b] = msg.split(':');
            onProgress && onProgress(Number(a) / Number(b));
          } else if (msg === 'DONE') {
            onProgress && onProgress(1);
            done();
          } else if (msg.startsWith('ERROR')) {
            done(new Error(msg.slice(6) || 'upload failed'));
          }
        };
      } catch (e) {
        done(e);
      }
    });
  }

  // Fallback: the regular multipart upload, with progress.
  function uploadHttp(dir, name, blob, onProgress) {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append('file', blob, name);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/upload?path=' + encodeURIComponent(dir));
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || 'upload failed')));
      xhr.onerror = () => reject(new Error('upload failed'));
      xhr.onabort = () => reject(new Error('upload aborted'));
      xhr.send(fd);
    });
  }

  let wsWorks = true;
  async function upload(dir, name, blob, onProgress) {
    if (blob.size > 64 * 1024 && wsWorks) {
      try { return await uploadWs(dir, name, blob, onProgress); } catch (e) { wsWorks = false; }
    }
    return uploadHttp(dir, name, blob, onProgress);
  }

  async function readNote(name) {
    const r = await fetch('/download?path=' + encodeURIComponent(`${DIR}/${name}`));
    if (!r.ok) throw new Error('Could not read ' + name);
    return new TextDecoder('utf-8').decode(await r.arrayBuffer());
  }

  // ---------- rendering ----------

  const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

  // Break text into lines that fit maxWidth; long words are split by character.
  function wrap(ctx, text, maxWidth) {
    const out = [];
    for (const para of text.replace(/\r/g, '').split('\n')) {
      if (!para.trim()) { out.push(''); continue; }
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width <= maxWidth) { line = test; continue; }
        if (line) out.push(line);
        if (ctx.measureText(word).width <= maxWidth) { line = word; continue; }
        line = '';
        for (const ch of word) {
          if (ctx.measureText(line + ch).width > maxWidth) { out.push(line); line = ch; } else { line += ch; }
        }
      }
      out.push(line);
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    return out;
  }

  // Draw the note on a white page, shrinking the text until it fits.
  function renderNote(name, text) {
    const [W, H] = SIZES[$('cpn-model').value] || SIZES.X3;
    const canvas = $('cpn-preview');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const M = Math.round(W * 0.08);
    const family = 'Georgia, "Noto Naskh Arabic", "Times New Roman", serif';
    const rtl = RTL.test(text);

    const date = (name.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
    const lines = text.replace(/\r/g, '').split('\n');
    const title = (lines.find((l) => l.trim()) || 'Note').trim();
    const body = lines.slice(lines.indexOf(lines.find((l) => l.trim())) + 1).join('\n').trim();

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.textBaseline = 'top';
    const x = rtl ? W - M : M;

    let y = M;
    if (date) {
      ctx.font = `${Math.round(W * 0.035)}px ${family}`;
      ctx.fillText(date, x, y);
      y += Math.round(W * 0.07);
    }

    ctx.font = `bold ${Math.round(W * 0.06)}px ${family}`;
    const titleLines = wrap(ctx, title, W - 2 * M).slice(0, 3);
    const tLead = Math.round(W * 0.075);
    for (const l of titleLines) { ctx.fillText(l, x, y); y += tLead; }
    y += Math.round(W * 0.02);
    ctx.fillRect(M, y, W - 2 * M, 2);
    y += Math.round(W * 0.05);

    if (body) {
      const room = H - M - y;
      let size = Math.round(W * 0.055), bodyLines, lead;
      for (; size >= 14; size -= 1) {
        ctx.font = `${size}px ${family}`;
        lead = Math.round(size * 1.4);
        bodyLines = wrap(ctx, body, W - 2 * M);
        if (bodyLines.length * lead <= room) break;
      }
      const max = Math.floor(room / lead);
      if (bodyLines.length > max) {
        bodyLines = bodyLines.slice(0, max);
        bodyLines[max - 1] = (bodyLines[max - 1] || '').replace(/\s*\S*$/, '') + ' …';
      }
      for (const l of bodyLines) { ctx.fillText(l, x, y); y += lead; }
    }

    canvas.hidden = false;
    return ctx.getImageData(0, 0, W, H);
  }

  // Encode RGBA pixels as an uncompressed 24-bit bottom-up BMP.
  function toBmp(img) {
    const { width: w, height: h, data } = img;
    const rowSize = Math.ceil((w * 3) / 4) * 4;
    const size = 54 + rowSize * h;
    const buf = new ArrayBuffer(size);
    const v = new DataView(buf);
    v.setUint8(0, 0x42); v.setUint8(1, 0x4d);
    v.setUint32(2, size, true);
    v.setUint32(10, 54, true);
    v.setUint32(14, 40, true);
    v.setInt32(18, w, true);
    v.setInt32(22, h, true);
    v.setUint16(26, 1, true);
    v.setUint16(28, 24, true);
    v.setUint32(34, rowSize * h, true);
    v.setInt32(38, 2835, true);
    v.setInt32(42, 2835, true);
    const out = new Uint8Array(buf);
    for (let row = 0; row < h; row++) {
      const src = (h - 1 - row) * w * 4;
      let dst = 54 + row * rowSize;
      for (let col = 0; col < w; col++) {
        const i = src + col * 4;
        out[dst++] = data[i + 2];
        out[dst++] = data[i + 1];
        out[dst++] = data[i];
      }
    }
    return new Blob([buf], { type: 'image/bmp' });
  }

  // Delete every .bmp already in /sleep so the new one is the only image.
  async function clearSleepFolder() {
    const r = await fetch('/api/files?path=' + encodeURIComponent(SLEEP_DIR));
    if (!r.ok) throw new Error('Could not read ' + SLEEP_DIR);
    const old = (await r.json()).filter((i) => !i.isDirectory && /\.bmp$/i.test(i.name));
    for (const f of old) {
      const d = await fetch('/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ path: `${SLEEP_DIR}/${f.name}`, type: 'file' }),
      });
      if (!d.ok) throw new Error(`Could not delete ${SLEEP_DIR}/${f.name}: ${await d.text()}`);
    }
    return old.length;
  }

  // Delete CrossPoint's cached sleep images (e.g. /.crosspoint/sleep_3.bmp) so
  // the reader can't show a stale copy. Only .bmp files whose name contains
  // "sleep", at the top of /.crosspoint. Never fatal: the reader may refuse to
  // list or delete inside its hidden system folder.
  async function clearSleepCache() {
    let files;
    try {
      const r = await fetch('/api/files?path=' + encodeURIComponent(CACHE_DIR));
      if (!r.ok) return { removed: 0, refused: 0, unreadable: true };
      files = (await r.json()).filter((i) => !i.isDirectory && /sleep/i.test(i.name) && /\.bmp$/i.test(i.name));
    } catch (e) {
      return { removed: 0, refused: 0, unreadable: true };
    }
    let removed = 0, refused = 0;
    for (const f of files) {
      try {
        const d = await fetch('/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form({ path: `${CACHE_DIR}/${f.name}`, type: 'file' }),
        });
        d.ok ? removed++ : refused++;
      } catch (e) { refused++; }
    }
    return { removed, refused, unreadable: false };
  }

  // One wallpaper job at a time; a new request waits for the current one
  // instead of being dropped.
  let queue = Promise.resolve();
  function setWallpaper(name, text) {
    const job = queue.then(() => drawAndUpload(name, text));
    queue = job.catch(() => {});
    return job;
  }

  async function drawAndUpload(name, text) {
    {
      const title = name.replace(/\.txt$/i, '');
      status('Drawing wallpaper… keep this page open.');
      const body = text !== undefined ? text : await readNote(name);
      const bmp = toBmp(renderNote(name, body));
      await ensureFolder(SLEEP_DIR);
      status('Removing the old wallpaper…');
      const removed = await clearSleepFolder();
      const cache = await clearSleepCache();
      let lastErr;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await upload(SLEEP_DIR, WALLPAPER, bmp, (f) =>
            status(`Saving wallpaper: ${Math.round(f * 100)}% — keep this page open.`));
          lastErr = null;
          break;
        } catch (e) { lastErr = e; }
      }
      if (lastErr) {
        store.set(KEY_WALL, '');
        throw new Error('could not save the wallpaper (' + lastErr.message + '). Is the reader still on File Transfer?');
      }
      store.set(KEY_WALL, name);
      const notes = [];
      if (removed) notes.push(`replaced ${removed} old image${removed > 1 ? 's' : ''}`);
      if (cache.removed) notes.push(`cleared ${cache.removed} cached sleep image${cache.removed > 1 ? 's' : ''}`);
      if (cache.refused) notes.push(`the reader would not let me delete ${cache.refused} cached image${cache.refused > 1 ? 's' : ''} in ${CACHE_DIR}`);
      status(`Done. Wallpaper set from "${title}"` + (notes.length ? ` (${notes.join('; ')}).` : '.'));
    }
  }

  // ---------- list and actions ----------

  async function refresh() {
    try {
      await ensureFolder(DIR);
      const r = await fetch('/api/files?path=' + encodeURIComponent(DIR));
      const items = (await r.json())
        .filter((i) => !i.isDirectory && /\.txt$/i.test(i.name))
        .sort((a, b) => b.name.localeCompare(a.name));
      const list = $('cpn-list');
      if (!items.length) { list.textContent = 'No notes yet.'; return; }
      list.innerHTML = items.map((i) => `
        <div class="row">
          <span class="name">${esc(i.name.replace(/\.txt$/i, ''))}</span>
          <div>
            <button data-wall="${esc(i.name)}">Wallpaper</button>
            <button data-del="${esc(i.name)}">Delete</button>
          </div>
        </div>`).join('');
      list.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = () => remove(b.getAttribute('data-del'));
      });
      list.querySelectorAll('[data-wall]').forEach((b) => {
        b.onclick = () => setWallpaper(b.getAttribute('data-wall'))
          .catch((e) => status('Failed: ' + e.message));
      });

    } catch (e) {
      status('Failed: ' + e.message);
    }
  }

  async function save() {
    const body = $('cpn-body').value;
    if (!body.trim() && !$('cpn-title').value.trim()) { status('Write something first.'); return; }
    status('Saving note…');
    $('cpn-save').disabled = true;
    try {
      await ensureFolder(DIR);
      const name = safeName($('cpn-title').value, body);
      const t = $('cpn-title').value.trim();
      const text = t ? (body.trim() ? `${t}\n\n${body}` : t) : body;
      await upload(DIR, name, new Blob([text], { type: 'text/plain;charset=utf-8' }));
      $('cpn-title').value = '';
      $('cpn-body').value = '';
      status('Note saved.');
      clearPrefill();
      refresh();
      if ($('cpn-auto').checked) await setWallpaper(name, text);
    } catch (e) {
      status('Failed: ' + e.message);
    } finally {
      $('cpn-save').disabled = false;
    }
  }

  async function remove(name) {
    if (!confirm(`Delete "${name}"?`)) return;
    const r = await fetch('/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ path: `${DIR}/${name}`, type: 'file' }),
    });
    status(r.ok ? 'Deleted.' : 'Delete failed.');
    refresh();
  }

  // ---------- prefill from the URL ----------

  function readPrefill() {
    let raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return null;
    const dec = (v) => { try { return decodeURIComponent(v); } catch (e) { return v; } };
    // note= takes the rest of the fragment, so a stray & or + in the text survives.
    if (/^note=/.test(raw)) {
      raw = 'note=' + encodeURIComponent(dec(raw.slice(5)));
    }
    const q = new Map();
    for (const pair of raw.split('&')) {
      const i = pair.indexOf('=');
      if (i > 0) q.set(pair.slice(0, i), dec(pair.slice(i + 1)));
    }
    const note = q.has('note') ? q.get('note') : null;
    if (note !== null) {
      const lines = note.replace(/\r/g, '').split('\n');
      const first = lines.findIndex((l) => l.trim());
      if (first < 0) return null;
      return { title: lines[first].trim(), body: lines.slice(first + 1).join('\n').replace(/^\n+/, '') };
    }
    if (!q.has('title') && !q.has('body')) return null;
    return { title: (q.get('title') || '').trim(), body: (q.get('body') || '').replace(/\r/g, '').replace(/^\s*\n/, '') };
  }

  function applyPrefill() {
    const p = readPrefill();
    if (!p) return;
    $('cpn-title').value = p.title.slice(0, 60);
    $('cpn-body').value = p.title.length > 60 ? `${p.title.slice(60)}\n${p.body}` : p.body;
    status('Note ready. Check it, then press Save to reader.');
    $('cpn-save').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // Drop the fragment after saving so a reload doesn't refill the card.
  function clearPrefill() {
    if (!location.hash) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
  }

  $('cpn-save').onclick = save;
  applyPrefill();
  // Safari may reuse an open tab and only change the fragment.
  window.addEventListener('hashchange', applyPrefill);
  // Opening the page only lists notes; nothing is uploaded until Save.
  refresh();
});
