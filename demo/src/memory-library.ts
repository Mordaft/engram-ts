import type { Engram, MemoryHeader } from 'engram-ts';
import { escapeHtml } from './html';

function renderError(): string {
  return `<section class="error-panel" role="alert"><i data-lucide="circle-alert"></i><div><strong>Memory lookup failed</strong><p>IndexedDB read failed; retry the selected memory lookup.</p></div><button class="outline" type="button" data-action="retry"><i data-lucide="refresh-cw"></i>Retry</button></section>`;
}

function renderRows(headers: MemoryHeader[]): string {
  if (headers.length === 0) {
    return `<div class="empty-inline"><i data-lucide="search"></i><span>No matching memories. Try another phrase or save a new one.</span></div>`;
  }
  return `<figure class="table-wrap"><table class="memory-table"><thead><tr><th scope="col">Memory</th><th scope="col">Type</th><th scope="col">Project</th><th scope="col">Records</th><th scope="col">Index</th><th scope="col"><span class="visually-hidden">Open</span></th></tr></thead><tbody>${headers.map((header) => `<tr><td><strong>${escapeHtml(header.title)}</strong><small>${escapeHtml(header.tags.slice(0, 3).join(' · ') || 'No tags')}</small></td><td>${escapeHtml(header.type)}</td><td>${escapeHtml(header.project)}</td><td>${header.recordCount}</td><td><span class="index-badge"><span></span>Ready</span></td><td><a class="open-memory" data-route href="/memory/${encodeURIComponent(header.id)}" aria-label="Open ${escapeHtml(header.title)}" title="Open memory"><i data-lucide="chevron-right"></i></a></td></tr>`).join('')}</tbody></table></figure>`;
}

export async function renderMemoryLibrary(memory: Engram, query: string, notice: string): Promise<string> {
  let stateMarkup = '';
  let rows = '';
  let count = 0;
  try {
    const results = await memory.search({ query, limit: 50 });
    count = results.length;
    rows = renderRows(results.map(({ header }) => header));
  } catch {
    stateMarkup = renderError();
  }

  return `<main class="workbench-main">
    <article class="welcome-band">
      <svg class="hero-mesh" aria-hidden="true" viewBox="0 0 800 260" preserveAspectRatio="none"><defs><radialGradient id="mesh-accent" cx="0%" cy="0%" r="85%"><stop offset="0%" stop-color="var(--brand-accent)" stop-opacity=".62"/><stop offset="100%" stop-color="var(--brand-accent)" stop-opacity="0"/></radialGradient><radialGradient id="mesh-primary" cx="100%" cy="100%" r="85%"><stop offset="0%" stop-color="var(--brand-primary)" stop-opacity=".55"/><stop offset="100%" stop-color="var(--brand-primary)" stop-opacity="0"/></radialGradient></defs><rect width="800" height="260" fill="url(#mesh-accent)"/><rect width="800" height="260" fill="url(#mesh-primary)"/></svg>
      <div class="welcome-copy"><span class="eyebrow">LOCAL-FIRST MEMORY WORKBENCH</span><h1>Keep the decisions.<br />Lose the rediscovery.</h1><p>Search conversation knowledge in your browser, then open only the records you need.</p><div class="hero-actions"><a href="#new-memory" class="hero-primary"><i data-lucide="plus"></i>Write a memory</a><a href="#memory-results" class="hero-secondary"><i data-lucide="book-open"></i>Browse memories</a></div></div>
      <div class="hero-mark" aria-hidden="true"><i data-lucide="database"></i><span>Dexie <b>+</b> Lunr</span></div>
    </article>
    ${notice ? `<p class="notice" role="status"><i data-lucide="check"></i>${escapeHtml(notice)}</p>` : ''}
    <section class="page-title-row" aria-labelledby="library-title"><div><p class="kicker">MEMORY LIBRARY</p><h2 id="library-title"><i data-lucide="book-open"></i>Find a thread worth keeping</h2><p class="section-description">${count} compact ${count === 1 ? 'header' : 'headers'} · full records load by ID</p></div><span class="storage-chip"><span></span>Browser storage</span></section>
    <form class="search-bar" data-form="search" role="search"><label class="visually-hidden" for="memory-search">Search memories</label><i data-lucide="search"></i><input id="memory-search" name="query" type="search" placeholder="Search titles, decisions, tags, or record text..." value="${escapeHtml(query)}" /><button type="submit">Search</button></form>
    <div class="library-layout">
      <section id="new-memory" class="surface-panel form-panel" aria-labelledby="new-memory-title"><div class="panel-heading"><div><p class="kicker">CAPTURE</p><h2 id="new-memory-title"><i data-lucide="plus"></i>New memory</h2></div><span class="step-mark">01</span></div>
        <form data-form="save" class="memory-form"><label for="memory-title">Title</label><input id="memory-title" name="title" type="text" placeholder="e.g. Decision on index rotation" required maxlength="140" />
          <div class="form-pair"><div><label for="memory-type">Type</label><select id="memory-type" name="type"><option>decision</option><option>architecture</option><option>implementation</option><option>bugfix</option><option>convention</option></select></div><div><label for="memory-project">Project</label><input id="memory-project" name="project" type="text" value="engram-ts" required /></div></div>
          <label for="memory-content">Conversation summary</label><textarea id="memory-content" name="content" rows="6" placeholder="What changed, why it mattered, and what to remember..." required aria-invalid="true" aria-describedby="content-guidance"></textarea><small id="content-guidance" class="field-warning">A focused summary keeps future search useful.</small>
          <label for="memory-tags">Tags <span class="label-optional">optional</span></label><input id="memory-tags" name="tags" type="text" placeholder="dexie, indexing, tokens" />
          <button type="submit" class="save-button"><i data-lucide="plus"></i>Save memory</button>
        </form>
      </section>
      <section id="memory-results" class="surface-panel results-panel" aria-labelledby="results-title"><div class="panel-heading"><div><p class="kicker">RETRIEVAL</p><h2 id="results-title"><i data-lucide="layers-3"></i>Memories found</h2></div><span class="result-count">${count.toString().padStart(2, '0')} <small>RESULTS</small></span></div>
        ${stateMarkup || rows}
        <footer class="index-footer"><span class="index-pulse"></span><span>Derived index is ready</span><span class="index-footer-note">Content stays in IndexedDB</span></footer>
      </section>
    </div>
    <footer class="page-footer"><span>engram-ts <span class="footer-dot">/</span> local memory, on your terms</span><span>IndexedDB is the source of truth</span></footer>
  </main>`;
}