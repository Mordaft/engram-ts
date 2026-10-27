import type { Engram } from 'engram-ts';
import { escapeHtml } from './html';

export async function renderConversationDetail(memory: Engram, memoryId: string): Promise<string> {
  let document;
  try {
    document = await memory.getById(memoryId);
  } catch {
    return `<main class="workbench-main detail-main"><a class="back-link" data-route href="/"><i data-lucide="arrow-left"></i>Memory library</a><section class="error-panel" role="alert"><i data-lucide="circle-alert"></i><div><strong>Error reading memory</strong><p>IndexedDB read failed; retry the selected memory lookup.</p></div><button type="button" class="outline" data-action="retry"><i data-lucide="refresh-cw"></i>Retry lookup</button></section></main>`;
  }
  if (!document) {
    return `<main class="workbench-main detail-main"><a class="back-link" data-route href="/"><i data-lucide="arrow-left"></i>Memory library</a><section class="empty-panel"><div class="empty-icon"><i data-lucide="file-text"></i></div><strong>Memory not found</strong><p>This ID may have been removed from this browser.</p><a class="outline-link" data-route href="/"><i data-lucide="book-open"></i>Return to library</a></section></main>`;
  }
  if (document.records.length === 0) {
    return `<main class="workbench-main detail-main"><a class="back-link" data-route href="/"><i data-lucide="arrow-left"></i>Memory library</a><section class="empty-panel"><div class="empty-icon"><i data-lucide="inbox"></i></div><strong>No records in this memory</strong><p>This memory has no conversation records to display.</p><a class="outline-link" data-route href="/"><i data-lucide="arrow-left"></i>Back to library</a></section></main>`;
  }

  const relatedResults = await memory.search({ query: 'MCP stdio transport', limit: 6 });
  const related = relatedResults.filter(({ header }) => header.id !== memoryId);
  const records = document.records.map((record) => `<article class="record-entry"><div class="record-topline"><span class="record-index">${String(document.records.indexOf(record) + 1).padStart(2, '0')}</span><time datetime="${escapeHtml(record.createdAt)}">${escapeHtml(record.createdAt.slice(0, 10))}</time></div><h3>${escapeHtml(record.title)}</h3><p>${escapeHtml(record.content)}</p><div class="tag-list">${record.tags.map((tag) => `<span class="memory-tag">${escapeHtml(tag)}</span>`).join('')}</div></article>`).join('');
  const relatedPanel = related.length > 0
    ? `<div class="related-list">${related.map(({ header }) => `<a data-route href="/memory/${encodeURIComponent(header.id)}" class="related-item"><span>${escapeHtml(header.title)}</span><i data-lucide="chevron-right"></i></a>`).join('')}</div>`
    : `<div class="empty-panel related-empty"><div class="empty-icon"><i data-lucide="search"></i></div><strong>No related memories</strong><p>No records matched the filter <b>MCP stdio transport</b>.</p><span class="filter-chip">FILTER · MCP STDIO TRANSPORT</span><a class="outline-link" data-route href="/"><i data-lucide="book-open"></i>Browse library</a></div>`;

  return `<main class="workbench-main detail-main"><a class="back-link" data-route href="/"><i data-lucide="arrow-left"></i>Memory library</a>
    <section class="detail-heading"><div class="detail-heading-icon"><i data-lucide="file-text"></i></div><div><p class="kicker">${escapeHtml(document.header.type)} <span class="footer-dot">/</span> ${escapeHtml(document.header.project)}</p><h1>${escapeHtml(document.header.title)}</h1><p>${document.records.length} full records · saved ${escapeHtml(document.header.createdAt.slice(0, 10))}</p></div><span class="index-badge"><span></span>Indexed</span></section>
    <div class="detail-layout"><section class="surface-panel records-panel"><div class="panel-heading"><div><p class="kicker">FULL CONTENT</p><h2><i data-lucide="layers-3"></i>Conversation records</h2></div><span class="result-count">${String(document.records.length).padStart(2, '0')} <small>RECORDS</small></span></div><div class="record-list">${records}</div></section>
      <aside class="surface-panel related-panel"><div class="panel-heading"><div><p class="kicker">DISCOVERY</p><h2><i data-lucide="search"></i>Related memories</h2></div></div>${relatedPanel}<div class="disclosure-note"><i data-lucide="database"></i><span>Full content was loaded only after opening this memory by ID.</span></div></aside></div>
    <footer class="page-footer"><span>engram-ts <span class="footer-dot">/</span> memory detail</span><span>Local browser storage</span></footer>
  </main>`;
}