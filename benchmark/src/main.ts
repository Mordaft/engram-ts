import '@picocss/pico/css/pico.min.css';
import './styles.css';
import {
  createIcons,
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock,
  Database,
  FileText,
  Gauge,
  Layers3,
  Moon,
  Play,
  RefreshCw,
  Search,
  Sun,
  Timer,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide';
import { clearBenchmarkDB, getDatabaseStats } from './database';
import {
  getCurrentDatasetSize,
  runSearchBenchmark,
  seedBenchmark,
} from './engine';
import { escapeHtml } from './html';
import type {
  BenchmarkDatasetSize,
  ComparisonHistoryEntry,
  ProgressUpdate,
  SearchBenchmarkResult,
  SeedBenchmarkResult,
} from './types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Benchmark app root #app was not found.');
}

// Reactive benchmark state
let currentDbCount = 0;
let isBusy = false;
let currentProgress: ProgressUpdate | null = null;
let lastSeedResult: SeedBenchmarkResult | null = null;
let lastSearchResult: SearchBenchmarkResult | null = null;
let searchQuery = 'database';
const historyEntries: ComparisonHistoryEntry[] = [];

const PRESET_KEYWORDS = [
  'database',
  'indexeddb',
  'lunr',
  'refactor',
  'token',
  'cache',
  'memory',
  'concurrency',
  'pipeline',
];

function currentTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('benchmark-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(): void {
  document.documentElement.dataset.theme = currentTheme();
}

function renderHeader(): string {
  const isDark = currentTheme() === 'dark';
  return `
    <header class="app-header">
      <div class="brand-group">
        <div class="brand">
          <span class="brand-mark">E</span>
          <span>engram<span style="color:var(--brand-primary);">-ts</span></span>
        </div>
        <span class="brand-badge"><i data-lucide="gauge"></i> Benchmark Suite</span>
      </div>
      <div class="header-actions">
        <div class="db-status-pill" title="Records currently stored in IndexedDB">
          <span class="status-indicator ${currentDbCount > 0 ? '' : 'empty'}"></span>
          <span><b>${currentDbCount.toLocaleString()}</b> records in IndexedDB</span>
        </div>
        <button type="button" class="theme-button" data-action="toggle-theme" aria-label="Toggle color theme" title="Toggle color theme">
          <i data-lucide="${isDark ? 'sun' : 'moon'}"></i>
        </button>
      </div>
    </header>
  `;
}

function renderHero(): string {
  return `
    <section class="hero-band">
      <div>
        <span class="hero-eyebrow"><i data-lucide="zap"></i> COMPARATIVE PERFORMANCE BENCHMARK</span>
        <h1>Direct IndexedDB vs Engram-ts (Lunr.js)</h1>
        <p class="hero-subtitle">
          Scale keyword search latency benchmark across <b>100</b>, <b>1,000</b>, <b>10,000</b>, and <b>50,000</b> records in the browser. Compares native table scans against the Engram-ts in-memory inverted index.
        </p>
      </div>
      <div class="hero-stats-badge">
        <strong>${currentDbCount > 0 ? currentDbCount.toLocaleString() : '0'}</strong>
        <span>Active records</span>
      </div>
    </section>
  `;
}

function renderSeedingSection(): string {
  const sizes: BenchmarkDatasetSize[] = [100, 1000, 10000, 50000];
  const activeSize = getCurrentDatasetSize() || currentDbCount;

  return `
    <section class="section-panel" aria-labelledby="step1-title">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="step-number">1</span>
          <div>
            <h2 id="step1-title">Seed and Index Records</h2>
            <p>Select a test dataset volume to store in the browser's local IndexedDB database.</p>
          </div>
        </div>
        ${
          currentDbCount > 0
            ? `<button class="outline secondary" data-action="clear-db" ${isBusy ? 'disabled' : ''} style="font-size:12px;padding:6px 12px;height:auto;">
                <i data-lucide="trash-2"></i> Clear DB
              </button>`
            : ''
        }
      </div>

      <div class="dataset-grid">
        ${sizes
          .map((size) => {
            const isActive = activeSize === size;
            return `
              <div class="preset-card ${isActive ? 'active' : ''}">
                <span class="preset-count">${size.toLocaleString()}</span>
                <span class="preset-desc">
                  ${
                    size === 100
                      ? 'Quick initial test'
                      : size === 1000
                        ? 'Standard moderate load'
                        : size === 10000
                          ? 'Medium agent scale'
                          : 'High volume (50k records)'
                  }
                </span>
                <button 
                  type="button" 
                  class="preset-btn" 
                  data-action="seed" 
                  data-size="${size}" 
                  ${isBusy ? 'disabled' : ''}>
                  <i data-lucide="play"></i> Load ${size.toLocaleString()}
                </button>
              </div>
            `;
          })
          .join('')}
      </div>

      ${
        currentProgress && currentProgress.stage !== 'done'
          ? `
            <div class="progress-panel">
              <div class="progress-header">
                <span>${escapeHtml(currentProgress.message)}</span>
                <span>${currentProgress.percent}%</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width: ${currentProgress.percent}%;"></div>
              </div>
              <div class="progress-sub">
                Records are inserted in batches into IndexedDB to prevent blocking the browser main thread.
              </div>
            </div>
          `
          : ''
      }

      ${
        lastSeedResult
          ? `
            <div class="ingest-results-row">
              <div class="metric-pill">
                <i data-lucide="database"></i>
                <span>IndexedDB Write: <strong>${lastSeedResult.insertDurationMs.toLocaleString()} ms</strong></span>
              </div>
              <div class="metric-pill">
                <i data-lucide="zap"></i>
                <span>Lunr.js Index Compile: <strong>${lastSeedResult.indexDurationMs.toLocaleString()} ms</strong></span>
              </div>
              <div class="metric-pill">
                <i data-lucide="timer"></i>
                <span>Total Setup Duration: <strong>${lastSeedResult.totalDurationMs.toLocaleString()} ms</strong></span>
              </div>
            </div>
          `
          : ''
      }
    </section>
  `;
}

function renderSearchSection(): string {
  const hasData = currentDbCount > 0;

  return `
    <section class="section-panel" aria-labelledby="step2-title">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="step-number">2</span>
          <div>
            <h2 id="step2-title">Keyword Search Benchmark</h2>
            <p>Run the same keyword query directly on the IndexedDB table and through Engram-ts with Lunr.js.</p>
          </div>
        </div>
      </div>

      <form data-form="search-bench" class="search-controls">
        <div class="search-input-wrapper">
          <input 
            type="text" 
            name="query" 
            id="query-input"
            value="${escapeHtml(searchQuery)}" 
            placeholder="Enter a keyword to search (e.g. database, refactor, token)..." 
            required 
            ${!hasData || isBusy ? 'disabled' : ''} 
          />
          <button type="submit" ${!hasData || isBusy ? 'disabled' : ''}>
            <i data-lucide="search"></i> Run Benchmark
          </button>
        </div>

        <div class="keyword-chips">
          <span class="chips-label">Frequent keywords:</span>
          ${PRESET_KEYWORDS.map(
            (kw) => `
            <button 
              type="button" 
              class="chip ${searchQuery.toLowerCase() === kw.toLowerCase() ? 'active' : ''}" 
              data-action="pick-chip" 
              data-word="${kw}"
              ${!hasData || isBusy ? 'disabled' : ''}>
              ${kw}
            </button>
          `,
          ).join('')}
        </div>
      </form>

      ${
        !hasData
          ? `
            <div style="text-align:center;padding:32px 20px;background:var(--color-sunken);border-radius:8px;border:1px dashed var(--color-border);color:var(--color-muted);">
              <i data-lucide="database" style="width:32px;height:32px;margin-bottom:8px;"></i>
              <p style="margin:0;font-weight:600;">Please seed records in Step 1 first to run the search benchmark.</p>
              <small>Try testing with 100, 1,000, 10,000, or 50,000 records.</small>
            </div>
          `
          : lastSearchResult
            ? renderSearchResults(lastSearchResult)
            : `
            <div style="text-align:center;padding:24px 20px;background:var(--color-sunken);border-radius:8px;border:1px dashed var(--color-border);color:var(--color-muted);">
              <i data-lucide="play" style="width:28px;height:28px;margin-bottom:6px;"></i>
              <p style="margin:0;">Click <b>Run Benchmark</b> or pick a test keyword above.</p>
            </div>
          `
      }
    </section>
  `;
}

function renderSearchResults(result: SearchBenchmarkResult): string {
  const maxTime = Math.max(result.indexedDbTimeMs, result.lunrTimeMs, 1);
  const idbWidthPercent = Math.min(100, Math.max(12, Math.round((result.indexedDbTimeMs / maxTime) * 100)));
  const lunrWidthPercent = Math.min(100, Math.max(6, Math.round((result.lunrTimeMs / maxTime) * 100)));

  return `
    <div class="speedup-callout">
      <div class="speedup-text">
        <span>Searching for keyword <b>“${escapeHtml(result.query)}”</b> across <b>${result.totalRecords.toLocaleString()}</b> records:</span>
      </div>
      <div class="speedup-badge">
        🚀 ${result.speedup}x FASTER
      </div>
    </div>

    <div class="comparison-grid">
      <!-- Direct IndexedDB Card -->
      <article class="engine-card idb-card">
        <div class="engine-card-header">
          <div class="engine-name">
            <i data-lucide="database" style="color:var(--color-warning);"></i>
            <span>Direct IndexedDB</span>
          </div>
          <span class="engine-tag">Full Table Scan</span>
        </div>
        <div class="engine-timing">
          <span class="time-val">${result.indexedDbTimeMs.toFixed(2)}</span>
          <span class="time-unit">ms</span>
        </div>
        <div class="engine-details">
          <div class="detail-item">
            <span>Matches found:</span>
            <strong>${result.indexedDbMatches.toLocaleString()}</strong>
          </div>
          <div class="detail-item">
            <span>Mechanism:</span>
            <span>IndexedDB table cursor / filter scan</span>
          </div>
          <div class="detail-item">
            <span>Algorithmic complexity:</span>
            <span>O(N) - Disk I/O + deserialization</span>
          </div>
        </div>
      </article>

      <!-- Engram-ts (Lunr.js) Card -->
      <article class="engine-card lunr-card">
        <div class="engine-card-header">
          <div class="engine-name">
            <i data-lucide="zap" style="color:var(--brand-primary);"></i>
            <span>Engram-ts + Lunr.js</span>
          </div>
          <span class="engine-tag">Inverted Index</span>
        </div>
        <div class="engine-timing">
          <span class="time-val">${result.lunrTimeMs.toFixed(2)}</span>
          <span class="time-unit">ms</span>
        </div>
        <div class="engine-details">
          <div class="detail-item">
            <span>Matches found:</span>
            <strong>${result.lunrMatches.toLocaleString()}</strong>
          </div>
          <div class="detail-item">
            <span>Mechanism:</span>
            <span>In-memory inverted index (TF-IDF)</span>
          </div>
          <div class="detail-item">
            <span>Algorithmic complexity:</span>
            <span>O(k) - In-memory token lookup</span>
          </div>
        </div>
      </article>
    </div>

    <!-- Visual Latency Comparison Bar -->
    <div class="latency-visual">
      <div class="latency-bar-row">
        <span class="latency-label">Direct IndexedDB</span>
        <div class="latency-track">
          <div class="latency-bar-fill idb-bar" style="width: ${idbWidthPercent}%;">
            ${result.indexedDbTimeMs.toFixed(2)} ms
          </div>
        </div>
      </div>
      <div class="latency-bar-row">
        <span class="latency-label">Engram-ts (Lunr.js)</span>
        <div class="latency-track">
          <div class="latency-bar-fill lunr-bar" style="width: ${lunrWidthPercent}%;">
            ${result.lunrTimeMs.toFixed(2)} ms
          </div>
        </div>
      </div>
    </div>

    <!-- Top Matches Preview -->
    <div class="matches-preview">
      <div class="preview-title">Top matches retrieved by Engram-ts:</div>
      ${result.lunrSample
        .map(
          (item) => `
        <div class="match-item">
          <strong>${escapeHtml(item.title)}</strong>
          <span>Lunr relevance score: <b>${item.score}</b></span>
        </div>
      `,
        )
        .join('')}
    </div>
  `;
}

function renderHistorySection(): string {
  if (historyEntries.length === 0) return '';

  return `
    <section class="section-panel" aria-labelledby="step3-title">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="step-number">3</span>
          <div>
            <h2 id="step3-title">Benchmark Runs History</h2>
            <p>Session log of benchmark runs across 100, 1,000, 10,000, and 50,000 records.</p>
          </div>
        </div>
      </div>

      <div class="history-table-wrap">
        <table class="history-table">
          <thead>
            <tr>
              <th>Records</th>
              <th>Keyword</th>
              <th>Direct IndexedDB</th>
              <th>Engram-ts (Lunr)</th>
              <th>Speedup</th>
              <th>Matches</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            ${historyEntries
              .map(
                (entry) => `
              <tr>
                <td><strong>${entry.records.toLocaleString()}</strong></td>
                <td><span class="chip" style="padding:2px 8px;font-size:11px;">${escapeHtml(entry.query)}</span></td>
                <td><span style="color:var(--color-warning);">${entry.directIdbMs.toFixed(2)} ms</span></td>
                <td><span class="highlight">${entry.lunrMs.toFixed(2)} ms</span></td>
                <td><strong class="highlight">🚀 ${entry.speedup}x</strong></td>
                <td>${entry.matches.toLocaleString()}</td>
                <td style="color:var(--color-muted);">${entry.timestamp}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderArchitectureExplanation(): string {
  return `
    <section class="section-panel" aria-labelledby="arch-title">
      <div class="panel-header">
        <div class="panel-title-group">
          <i data-lucide="layers-3" style="color:var(--brand-primary);width:22px;height:22px;"></i>
          <div>
            <h2 id="arch-title">Why Does This Performance Difference Exist?</h2>
            <p>Architectural breakdown of native IndexedDB vs the Lunr.js in-memory inverted index in Engram-ts.</p>
          </div>
        </div>
      </div>

      <div class="architecture-grid">
        <div class="arch-card">
          <h3><i data-lucide="database" style="color:var(--color-warning);"></i> Direct Search in IndexedDB</h3>
          <p>
            IndexedDB is a document-oriented database structured with B+ trees for primary keys and exact indexes. 
            <b>It has no native Full-Text Search (FTS) engine</b>. To search a word in titles or contents, the browser must execute a <i>Full Table Scan</i>:
          </p>
          <ul style="margin:8px 0 0 16px;font-size:12px;color:var(--color-muted);line-height:1.5;">
            <li>Iterate over every record on disk via cursors.</li>
            <li>Deserialize every JS object using the browser's Structured Clone algorithm.</li>
            <li>Execute <code>.includes(word)</code> sequentially on the V8 main thread.</li>
            <li>As records grow to 10,000 and 50,000, latency scales linearly O(N) up to several seconds.</li>
          </ul>
        </div>

        <div class="arch-card">
          <h3><i data-lucide="zap" style="color:var(--brand-primary);"></i> Engram-ts Powered by Lunr.js</h3>
          <p>
            Engram-ts implements Alan Buscaglia's (Gentleman Programming) architecture, using IndexedDB strictly as a <b>durable source of truth</b> and delegating retrieval to an <b>in-memory inverted index</b> compiled via Lunr.js:
          </p>
          <ul style="margin:8px 0 0 16px;font-size:12px;color:var(--color-muted);line-height:1.5;">
            <li>Tokenization, stop-word elimination, and linguistic stemming.</li>
            <li>Postings list structure in RAM: each token points directly to matching memory IDs.</li>
            <li>Instant sub-millisecond retrieval O(k) with field boosting (title: 10x, tags: 3x, etc.).</li>
            <li>AI agents receive relevant context in 1–10 ms without bloating tokens or blocking on I/O.</li>
          </ul>
        </div>
      </div>
    </section>
  `;
}

async function render(): Promise<void> {
  applyTheme();
  app.innerHTML = `
    ${renderHeader()}
    <main class="benchmark-main">
      ${renderHero()}
      ${renderSeedingSection()}
      ${renderSearchSection()}
      ${renderHistorySection()}
      ${renderArchitectureExplanation()}
    </main>
    <footer class="app-footer">
      <span>Engram-ts Benchmark Suite · Independent performance evaluation tool · The Unlicense</span>
    </footer>
  `;
  createIcons({
    icons: {
      Activity,
      ArrowRight,
      BarChart3,
      Check,
      CheckCircle2,
      CircleAlert,
      Clock,
      Database,
      FileText,
      Gauge,
      Layers3,
      Moon,
      Play,
      RefreshCw,
      Search,
      Sun,
      Timer,
      Trash2,
      TrendingUp,
      Zap,
    },
  });
}

// Event Listeners
app.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const actionBtn = target.closest<HTMLElement>('[data-action]');
  if (!actionBtn) return;
  const action = actionBtn.dataset.action;

  if (action === 'toggle-theme') {
    const isDark = currentTheme() === 'dark';
    localStorage.setItem('benchmark-theme', isDark ? 'light' : 'dark');
    await render();
  } else if (action === 'seed') {
    const size = Number(actionBtn.dataset.size) as BenchmarkDatasetSize;
    if (!size || isBusy) return;

    isBusy = true;
    lastSearchResult = null;
    await render();

    try {
      lastSeedResult = await seedBenchmark(size, async (update) => {
        currentProgress = update;
        await render();
      });
      const stats = await getDatabaseStats();
      currentDbCount = stats.records;

      // Auto-run first benchmark with the current keyword
      const searchRes = await runSearchBenchmark(searchQuery, 3);
      lastSearchResult = searchRes;
      historyEntries.unshift({
        records: size,
        insertMs: lastSeedResult.insertDurationMs,
        indexMs: lastSeedResult.indexDurationMs,
        query: searchQuery,
        directIdbMs: searchRes.indexedDbTimeMs,
        lunrMs: searchRes.lunrTimeMs,
        speedup: searchRes.speedup,
        matches: searchRes.lunrMatches,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      console.error('Error seeding benchmark data:', err);
      alert('Benchmark error: ' + String(err));
    } finally {
      isBusy = false;
      currentProgress = null;
      await render();
    }
  } else if (action === 'clear-db') {
    if (isBusy) return;
    if (confirm('Are you sure you want to clear the benchmark database?')) {
      isBusy = true;
      await clearBenchmarkDB();
      currentDbCount = 0;
      lastSeedResult = null;
      lastSearchResult = null;
      isBusy = false;
      await render();
    }
  } else if (action === 'pick-chip') {
    const word = actionBtn.dataset.word;
    if (!word || isBusy || currentDbCount === 0) return;
    searchQuery = word;
    isBusy = true;
    await render();
    try {
      const searchRes = await runSearchBenchmark(searchQuery, 3);
      lastSearchResult = searchRes;
      historyEntries.unshift({
        records: currentDbCount,
        insertMs: lastSeedResult?.insertDurationMs ?? 0,
        indexMs: lastSeedResult?.indexDurationMs ?? 0,
        query: searchQuery,
        directIdbMs: searchRes.indexedDbTimeMs,
        lunrMs: searchRes.lunrTimeMs,
        speedup: searchRes.speedup,
        matches: searchRes.lunrMatches,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      isBusy = false;
      await render();
    }
  }
});

app.addEventListener('submit', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) return;
  event.preventDefault();

  if (target.dataset.form === 'search-bench') {
    if (isBusy || currentDbCount === 0) return;
    const formData = new FormData(target);
    const query = String(formData.get('query') ?? '').trim();
    if (!query) return;

    searchQuery = query;
    isBusy = true;
    await render();

    try {
      const searchRes = await runSearchBenchmark(searchQuery, 3);
      lastSearchResult = searchRes;
      historyEntries.unshift({
        records: currentDbCount,
        insertMs: lastSeedResult?.insertDurationMs ?? 0,
        indexMs: lastSeedResult?.indexDurationMs ?? 0,
        query: searchQuery,
        directIdbMs: searchRes.indexedDbTimeMs,
        lunrMs: searchRes.lunrTimeMs,
        speedup: searchRes.speedup,
        matches: searchRes.lunrMatches,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      isBusy = false;
      await render();
    }
  }
});

// Initialize application
async function init(): Promise<void> {
  const stats = await getDatabaseStats();
  currentDbCount = stats.records;
  await render();
}

void init();
