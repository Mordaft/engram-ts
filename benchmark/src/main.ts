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

// Estado reactivo de la aplicación de Benchmark
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
        <div class="db-status-pill" title="Registros actualmente guardados en IndexedDB">
          <span class="status-indicator ${currentDbCount > 0 ? '' : 'empty'}"></span>
          <span><b>${currentDbCount.toLocaleString()}</b> registros en IndexedDB</span>
        </div>
        <button type="button" class="theme-button" data-action="toggle-theme" aria-label="Cambiar tema" title="Cambiar tema claro/oscuro">
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
        <span class="hero-eyebrow"><i data-lucide="zap"></i> PRUEBA DE RENDIMIENTO COMPARATIVA</span>
        <h1>IndexedDB Directo vs Engram-ts (Lunr.js)</h1>
        <p class="hero-subtitle">
          Evaluación de tiempos de búsqueda por palabra clave a escala con <b>100</b>, <b>1.000</b>, <b>10.000</b> y <b>50.000</b> registros en el navegador. Compara el escaneo nativo de tablas contra el índice invertido en memoria de Engram-ts.
        </p>
      </div>
      <div class="hero-stats-badge">
        <strong>${currentDbCount > 0 ? currentDbCount.toLocaleString() : '0'}</strong>
        <span>Registros activos</span>
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
            <h2 id="step1-title">Poblar e Indexar Registros</h2>
            <p>Selecciona el volumen de prueba para almacenar en la base de datos IndexedDB local del navegador.</p>
          </div>
        </div>
        ${
          currentDbCount > 0
            ? `<button class="outline secondary" data-action="clear-db" ${isBusy ? 'disabled' : ''} style="font-size:12px;padding:6px 12px;height:auto;">
                <i data-lucide="trash-2"></i> Limpiar DB
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
                      ? 'Prueba rápida inicial'
                      : size === 1000
                        ? 'Carga moderada estándar'
                        : size === 10000
                          ? 'Escala media de agente'
                          : 'Gran volumen (50k registros)'
                  }
                </span>
                <button 
                  type="button" 
                  class="preset-btn" 
                  data-action="seed" 
                  data-size="${size}" 
                  ${isBusy ? 'disabled' : ''}>
                  <i data-lucide="play"></i> Cargar ${size.toLocaleString()}
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
                Los registros se insertan en lotes (batching) en IndexedDB para no bloquear el hilo del navegador.
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
                <span>Escritura en IndexedDB: <strong>${lastSeedResult.insertDurationMs.toLocaleString()} ms</strong></span>
              </div>
              <div class="metric-pill">
                <i data-lucide="zap"></i>
                <span>Compilación Índice Lunr.js: <strong>${lastSeedResult.indexDurationMs.toLocaleString()} ms</strong></span>
              </div>
              <div class="metric-pill">
                <i data-lucide="timer"></i>
                <span>Tiempo Total de Preparación: <strong>${lastSeedResult.totalDurationMs.toLocaleString()} ms</strong></span>
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
            <h2 id="step2-title">Comparativa de Búsqueda por Palabra</h2>
            <p>Ejecuta la misma consulta por palabra clave directamente en la tabla de IndexedDB y a través de Engram-ts con Lunr.js.</p>
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
            placeholder="Introduce una palabra a buscar (ej: database, refactor, token)..." 
            required 
            ${!hasData || isBusy ? 'disabled' : ''} 
          />
          <button type="submit" ${!hasData || isBusy ? 'disabled' : ''}>
            <i data-lucide="search"></i> Ejecutar Benchmark
          </button>
        </div>

        <div class="keyword-chips">
          <span class="chips-label">Palabras frecuentes:</span>
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
              <p style="margin:0;font-weight:600;">Primero carga registros en el Paso 1 para ejecutar la prueba de búsqueda.</p>
              <small>Prueba con 100, 1.000, 10.000 o 50.000 registros.</small>
            </div>
          `
          : lastSearchResult
            ? renderSearchResults(lastSearchResult)
            : `
            <div style="text-align:center;padding:24px 20px;background:var(--color-sunken);border-radius:8px;border:1px dashed var(--color-border);color:var(--color-muted);">
              <i data-lucide="play" style="width:28px;height:28px;margin-bottom:6px;"></i>
              <p style="margin:0;">Haz clic en <b>Ejecutar Benchmark</b> o elige una palabra de prueba arriba.</p>
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
        <span>Búsqueda de la palabra <b>“${escapeHtml(result.query)}”</b> sobre <b>${result.totalRecords.toLocaleString()}</b> registros:</span>
      </div>
      <div class="speedup-badge">
        🚀 ${result.speedup}x MÁS RÁPIDO
      </div>
    </div>

    <div class="comparison-grid">
      <!-- Tarjeta IndexedDB Directo -->
      <article class="engine-card idb-card">
        <div class="engine-card-header">
          <div class="engine-name">
            <i data-lucide="database" style="color:var(--color-warning);"></i>
            <span>IndexedDB Directo</span>
          </div>
          <span class="engine-tag">Full Table Scan</span>
        </div>
        <div class="engine-timing">
          <span class="time-val">${result.indexedDbTimeMs.toFixed(2)}</span>
          <span class="time-unit">ms</span>
        </div>
        <div class="engine-details">
          <div class="detail-item">
            <span>Coincidencias encontradas:</span>
            <strong>${result.indexedDbMatches.toLocaleString()}</strong>
          </div>
          <div class="detail-item">
            <span>Mecanismo:</span>
            <span>Cursor / Filter en tabla IndexedDB</span>
          </div>
          <div class="detail-item">
            <span>Complejidad algorítmica:</span>
            <span>O(N) - I/O disco + deserialización</span>
          </div>
        </div>
      </article>

      <!-- Tarjeta Engram-ts (Lunr.js) -->
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
            <span>Coincidencias encontradas:</span>
            <strong>${result.lunrMatches.toLocaleString()}</strong>
          </div>
          <div class="detail-item">
            <span>Mecanismo:</span>
            <span>Índice invertido en memoria RAM (TF-IDF)</span>
          </div>
          <div class="detail-item">
            <span>Complejidad algorítmica:</span>
            <span>O(k) - Búsqueda de tokens en memoria</span>
          </div>
        </div>
      </article>
    </div>

    <!-- Barra de comparación visual de latencia -->
    <div class="latency-visual">
      <div class="latency-bar-row">
        <span class="latency-label">IndexedDB Directo</span>
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

    <!-- Muestra de registros coincidentes -->
    <div class="matches-preview">
      <div class="preview-title">Primeras coincidencias recuperadas por Engram-ts (Top resultados):</div>
      ${result.lunrSample
        .map(
          (item) => `
        <div class="match-item">
          <strong>${escapeHtml(item.title)}</strong>
          <span>Score de relevancia Lunr: <b>${item.score}</b></span>
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
            <h2 id="step3-title">Histórico de Comparativas Ejecutadas</h2>
            <p>Registro de las pruebas realizadas en esta sesión para 100, 1.000, 10.000 y 50.000 registros.</p>
          </div>
        </div>
      </div>

      <div class="history-table-wrap">
        <table class="history-table">
          <thead>
            <tr>
              <th>Registros</th>
              <th>Palabra</th>
              <th>IndexedDB Directo</th>
              <th>Engram-ts (Lunr)</th>
              <th>Aceleración</th>
              <th>Coincidencias</th>
              <th>Hora</th>
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
            <h2 id="arch-title">¿Por qué existe esta diferencia de rendimiento?</h2>
            <p>Análisis arquitectónico de IndexedDB frente al índice invertido de Lunr.js en Engram-ts.</p>
          </div>
        </div>
      </div>

      <div class="architecture-grid">
        <div class="arch-card">
          <h3><i data-lucide="database" style="color:var(--color-warning);"></i> Búsqueda Directa en IndexedDB</h3>
          <p>
            IndexedDB es una base de datos documental estructurada mediante árboles B+ orientada a claves primarias e índices exactos. 
            <b>No cuenta con motor de búsqueda de texto completo (FTS)</b>. Para buscar una palabra en títulos o contenidos, el navegador debe realizar un <i>Full Table Scan</i>:
          </p>
          <ul style="margin:8px 0 0 16px;font-size:12px;color:var(--color-muted);line-height:1.5;">
            <li>Recorrer cada registro de disco mediante cursores.</li>
            <li>Deserializar cada objeto JS mediante Structured Clone.</li>
            <li>Ejecutar <code>.includes(word)</code> secuencialmente en el hilo V8.</li>
            <li>A medida que crecen los registros a 10.000 y 50.000, el tiempo crece linealmente O(N) hasta varios segundos.</li>
          </ul>
        </div>

        <div class="arch-card">
          <h3><i data-lucide="zap" style="color:var(--brand-primary);"></i> Engram-ts gracias a Lunr.js</h3>
          <p>
            Engram-ts adopta la arquitectura de Alan Buscaglia (Gentleman Programming), utilizando IndexedDB únicamente como <b>fuente de verdad duradera</b> y delegando la búsqueda a un <b>índice invertido compilado en memoria RAM</b> mediante Lunr.js:
          </p>
          <ul style="margin:8px 0 0 16px;font-size:12px;color:var(--color-muted);line-height:1.5;">
            <li>Tokenización, eliminación de stop-words y stemming (raíz léxica).</li>
            <li>Estructura de postings list en RAM: cada token apunta directamente a los IDs de memoria.</li>
            <li>Búsqueda instantánea sub-milisegundo O(k) con ponderación por campos (title: 10x, tags: 3x, etc.).</li>
            <li>Los agentes de IA reciben respuestas en 1-10 ms sin saturar tokens ni esperar bloqueos de I/O.</li>
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
      <span>Engram-ts Benchmark Suite · Implementación independiente de evaluación de rendimiento · MIT License</span>
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

      // Auto-ejecuta el primer benchmark con la palabra actual
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
      console.error('Error al poblar datos de benchmark:', err);
      alert('Error en benchmark: ' + String(err));
    } finally {
      isBusy = false;
      currentProgress = null;
      await render();
    }
  } else if (action === 'clear-db') {
    if (isBusy) return;
    if (confirm('¿Deseas vaciar la base de datos de benchmark?')) {
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

// Inicialización de la aplicación
async function init(): Promise<void> {
  const stats = await getDatabaseStats();
  currentDbCount = stats.records;
  await render();
}

void init();
