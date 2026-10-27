import '@picocss/pico/css/pico.min.css';
import './styles.css';
import { Engram } from 'engram-ts';
import {
  createIcons,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Database,
  FileText,
  Inbox,
  Layers3,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
} from 'lucide';
import { renderConversationDetail } from './conversation-detail';
import { escapeHtml } from './html';
import { renderMemoryLibrary } from './memory-library';

const memory = new Engram();
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Demo app root was not found.');
}

let searchQuery = new URLSearchParams(window.location.search).get('q') ?? '';
let notice = '';

function currentTheme(): 'light' | 'dark' | 'system' {
  const stored = localStorage.getItem('app-theme');
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function applyTheme(): void {
  const preference = currentTheme();
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}

function renderHeader(path: string): string {
  const detailActive = path.startsWith('/memory/');
  return `<header class="app-header"><a class="brand" data-route href="/" aria-label="Engram home"><span class="brand-mark">E</span><span>engram<span class="brand-suffix">-ts</span></span></a><span class="local-label"><span></span>Local browser memory</span><button type="button" class="theme-button" data-action="theme-toggle" aria-label="Toggle color theme" title="Toggle color theme"><i data-lucide="${document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'}"></i></button></header>
  <nav class="app-nav" aria-label="Primary navigation"><a data-route href="/" class="${detailActive ? '' : 'active'}"><i data-lucide="book-open"></i>Memory library</a>${detailActive ? `<a data-route href="${escapeHtml(path)}" class="active"><i data-lucide="file-text"></i>Conversation detail</a>` : ''}</nav>`;
}

async function renderApp(): Promise<void> {
  applyTheme();
  const path = window.location.pathname;
  const content = path.startsWith('/memory/')
    ? await renderConversationDetail(memory, decodeURIComponent(path.slice('/memory/'.length)))
    : await renderMemoryLibrary(memory, searchQuery, notice);
  app.innerHTML = `${renderHeader(path)}${content}`;
  notice = '';
  createIcons({ icons: { ArrowLeft, BookOpen, Check, ChevronRight, CircleAlert, Database, FileText, Inbox, Layers3, Moon, Plus, RefreshCw, Search, Sun } });
  const contentField = document.querySelector<HTMLTextAreaElement>('#memory-content');
  contentField?.addEventListener('input', () => {
    contentField.setAttribute('aria-invalid', String(contentField.value.trim().length === 0));
  });
}

app.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const routeLink = target.closest<HTMLAnchorElement>('a[data-route]');
  if (routeLink && routeLink.origin === window.location.origin) {
    event.preventDefault();
    if (routeLink.pathname === '/') searchQuery = '';
    window.history.pushState(null, '', routeLink.pathname);
    void renderApp();
    return;
  }
  const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
  if (action === 'theme-toggle') {
    const isDark = document.documentElement.dataset.theme === 'dark';
    localStorage.setItem('app-theme', isDark ? 'light' : 'dark');
    void renderApp();
  } else if (action === 'focus-title') {
    document.querySelector<HTMLInputElement>('#memory-title')?.focus();
  } else if (action === 'retry') {
    void renderApp();
  }
});

app.addEventListener('submit', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) return;
  event.preventDefault();
  const formData = new FormData(target);
  if (target.dataset.form === 'search') {
    searchQuery = String(formData.get('query') ?? '').trim();
    window.history.replaceState(null, '', searchQuery ? `/?q=${encodeURIComponent(searchQuery)}` : '/');
    await renderApp();
  } else if (target.dataset.form === 'save') {
    const title = String(formData.get('title') ?? '').trim();
    const content = String(formData.get('content') ?? '').trim();
    const project = String(formData.get('project') ?? '').trim();
    if (!title || !content || !project) return;
    const tags = String(formData.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
    await memory.save({
      title,
      type: String(formData.get('type') ?? 'decision'),
      project,
      ...(tags.length > 0 ? { tags } : {}),
      records: [{ title, content, ...(tags.length > 0 ? { tags } : {}) }],
    });
    searchQuery = '';
    window.history.replaceState(null, '', '/');
    notice = `Saved “${title}” to this browser.`;
    await renderApp();
  }
});

window.addEventListener('popstate', () => {
  searchQuery = new URLSearchParams(window.location.search).get('q') ?? '';
  void renderApp();
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentTheme() === 'system') applyTheme();
});

void renderApp();