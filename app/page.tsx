'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import LeaderboardControls from '@/components/LeaderboardControls';
import LeaderboardTable from '@/components/LeaderboardTable';
import PodiumView from '@/components/PodiumView';
import SheetUrlForm from '@/components/SheetUrlForm';
import StatusMessage from '@/components/StatusMessage';
import { parseSheetCsv } from '@/lib/csv';
import { buildCsvUrl, parseSheetUrl } from '@/lib/googleSheets';
import { computeLeaderboard, getUniquePositions } from '@/lib/leaderboard';
import type { LeaderboardEntry, LeaderboardFilters, LeaderboardResult, ParsedSheet } from '@/types/leaderboard';

const DEFAULT_FILTERS: LeaderboardFilters = {
  metric: '',
  sortDirection: 'highest',
  dateFilter: 'all',
  dateFrom: '',
  dateTo: '',
  positionFilter: '',
  mode: 'best',
  topN: null,
};

const REFRESH_MS = 30_000;

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      className={`transition-transform duration-300 ${open ? 'rotate-180' : 'rotate-0'}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function IconCollapse() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="10" y1="14" x2="3" y2="21" />
      <line x1="21" y1="3" x2="14" y2="10" />
    </svg>
  );
}

let activeCtx: AudioContext | null = null;

export default function Page() {
  const [loading, setLoading]                 = useState(false);
  const [refreshing, setRefreshing]           = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [refreshError, setRefreshError]       = useState<string | null>(null);
  const [sheet, setSheet]                     = useState<ParsedSheet | null>(null);
  const [filters, setFilters]                 = useState<LeaderboardFilters>(DEFAULT_FILTERS);
  const [csvUrl, setCsvUrl]                   = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed]     = useState<Date | null>(null);
  const [filtersOpen, setFiltersOpen]         = useState(true);
  const [isPresenting, setIsPresenting]       = useState(false);
  const [countdownPct, setCountdownPct]       = useState(100);
  const [savedUrl, setSavedUrl]               = useState('');

  const [rankChanges, setRankChanges] = useState<Map<string, 'up' | 'down'>>(new Map());
  const [newLeader, setNewLeader]     = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [isPodium, setIsPodium]   = useState(false);

  const csvUrlRef          = useRef<string | null>(null);
  const resultRef          = useRef<LeaderboardResult | null>(null);
  const preRefreshSnapshot = useRef<LeaderboardEntry[]>([]);
  const exportRef          = useRef<HTMLDivElement>(null);
  csvUrlRef.current = csvUrl;

  // ── New-leader sound: subtle rise + ping (~550 ms) ────────────────────────

  function playNewLeaderSound() {
    try {
      // Stop any previous instance so sounds never overlap
      if (activeCtx) { activeCtx.close(); activeCtx = null; }

      const ctx = new AudioContext();
      activeCtx = ctx;
      const now = ctx.currentTime;

      // Master gain — keeps overall level comfortable
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.42, now);
      master.connect(ctx.destination);

      // ── Phase 1: Rise (0 → 260 ms) ────────────────────────────────────────
      // Smooth sine glide 420 Hz → 700 Hz
      const rise = ctx.createOscillator(); rise.type = 'sine';
      rise.frequency.setValueAtTime(420, now);
      rise.frequency.exponentialRampToValueAtTime(700, now + 0.26);
      const riseEnv = ctx.createGain();
      riseEnv.gain.setValueAtTime(0,    now);
      riseEnv.gain.linearRampToValueAtTime(0.7,  now + 0.012); // soft attack
      riseEnv.gain.setValueAtTime(0.7,           now + 0.20);
      riseEnv.gain.linearRampToValueAtTime(0,    now + 0.30);  // fade into ping
      rise.connect(riseEnv); riseEnv.connect(master);
      rise.start(now); rise.stop(now + 0.31);

      // Subtle detuned layer for richness (+7 cents, 35% volume)
      const rise2 = ctx.createOscillator(); rise2.type = 'sine';
      rise2.detune.value = 7;
      rise2.frequency.setValueAtTime(420, now);
      rise2.frequency.exponentialRampToValueAtTime(700, now + 0.26);
      const rise2Env = ctx.createGain();
      rise2Env.gain.setValueAtTime(0,    now);
      rise2Env.gain.linearRampToValueAtTime(0.25, now + 0.012);
      rise2Env.gain.setValueAtTime(0.25,          now + 0.20);
      rise2Env.gain.linearRampToValueAtTime(0,    now + 0.30);
      rise2.connect(rise2Env); rise2Env.connect(master);
      rise2.start(now); rise2.stop(now + 0.31);

      // ── Phase 2: Ping (240 ms → 560 ms) ───────────────────────────────────
      // Starts before rise fully ends so the two phases feel like one gesture
      const pt = now + 0.24;
      const ping = ctx.createOscillator(); ping.type = 'triangle';
      ping.frequency.setValueAtTime(820, pt); // slightly above end of rise
      const pingEnv = ctx.createGain();
      pingEnv.gain.setValueAtTime(0,     pt);
      pingEnv.gain.linearRampToValueAtTime(0.55, pt + 0.014); // crisp but soft attack
      pingEnv.gain.exponentialRampToValueAtTime(0.001, pt + 0.32); // smooth decay
      ping.connect(pingEnv); pingEnv.connect(master);
      ping.start(pt); ping.stop(pt + 0.33);

      // Subtle octave harmonic on the ping for shimmer (decays faster)
      const ping2 = ctx.createOscillator(); ping2.type = 'sine';
      ping2.frequency.setValueAtTime(1640, pt);
      const ping2Env = ctx.createGain();
      ping2Env.gain.setValueAtTime(0,     pt);
      ping2Env.gain.linearRampToValueAtTime(0.12, pt + 0.014);
      ping2Env.gain.exponentialRampToValueAtTime(0.001, pt + 0.18);
      ping2.connect(ping2Env); ping2Env.connect(master);
      ping2.start(pt); ping2.stop(pt + 0.19);

      setTimeout(() => {
        ctx.close();
        if (activeCtx === ctx) activeCtx = null;
      }, 700);
    } catch { /* AudioContext may be blocked before a user gesture */ }
  }

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchSheet = useCallback(async (url: string, isInitial: boolean) => {
    if (isInitial) setLoading(true); else setRefreshing(true);

    let text: string;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Sheet returned status ${res.status}. Ensure it is shared publicly.`);
      text = await res.text();
      if (text.trim().startsWith('<!')) throw new Error('Sheet returned HTML — ensure it is shared as "Anyone with the link — Viewer".');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch sheet.';
      if (isInitial) setError(msg); else setRefreshError(msg);
      if (isInitial) setLoading(false); else setRefreshing(false);
      return;
    }

    try {
      const parsed = parseSheetCsv(text);
      setSheet(parsed);
      setLastRefreshed(new Date());
      setRefreshError(null);
      if (isInitial) {
        setFilters({ ...DEFAULT_FILTERS, metric: parsed.metricColumns[0] });
      } else {
        setFilters(prev => ({
          ...prev,
          metric: parsed.metricColumns.includes(prev.metric) ? prev.metric : parsed.metricColumns[0],
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse sheet.';
      if (isInitial) setError(msg); else setRefreshError(msg);
    } finally {
      if (isInitial) setLoading(false); else setRefreshing(false);
    }
  }, []);

  const handleUrlSubmit = useCallback(async (url: string) => {
    const parts = parseSheetUrl(url);
    if (!parts) { setError('Invalid Google Sheet URL. Paste the full URL from your browser.'); return; }
    localStorage.setItem('leaderboard-sheet-url', url);
    const exportUrl = buildCsvUrl(parts);
    setError(null); setRefreshError(null); setSheet(null); setLastRefreshed(null);
    setCsvUrl(exportUrl);
    await fetchSheet(exportUrl, true);
  }, [fetchSheet]);

  const handleManualRefresh = useCallback(() => {
    if (csvUrlRef.current && !refreshing) fetchSheet(csvUrlRef.current, false);
  }, [fetchSheet, refreshing]);

  const exportPdf = useCallback(async () => {
    if (!exportRef.current || exporting) return;
    setExporting(true);
    try {
      const [{ toCanvas }, { default: jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);
      exportRef.current.classList.add('export-snapshot');
      await new Promise(r => setTimeout(r, 60));
      const canvas = await toCanvas(exportRef.current, {
        backgroundColor: '#080e1a',
        pixelRatio: 2,
      });
      exportRef.current.classList.remove('export-snapshot');
      const imgData = canvas.toDataURL('image/png');
      const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW    = pdf.internal.pageSize.getWidth();   // 210mm
      const pdfH    = pdf.internal.pageSize.getHeight();  // 297mm

      // Scale image to fill the full page width
      const imgW = pdfW;
      const imgH = canvas.height * (pdfW / canvas.width);

      // Slice across as many pages as needed
      let yOffset = 0;
      while (yOffset < imgH) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -yOffset, imgW, imgH);
        yOffset += pdfH;
      }
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`leaderboard-${filters.metric.replace(/\s+/g, '-')}-${date}.pdf`);
    } finally {
      setExporting(false);
    }
  }, [exporting, filters.metric]);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Auto-load last-used sheet URL from localStorage on first mount
  useEffect(() => {
    const saved = localStorage.getItem('leaderboard-sheet-url');
    if (saved) { setSavedUrl(saved); handleUrlSubmit(saved); }
  }, [handleUrlSubmit]);

  useEffect(() => {
    if (!csvUrl) return;
    const id = setInterval(() => { if (csvUrlRef.current) fetchSheet(csvUrlRef.current, false); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [csvUrl, fetchSheet]);

  useEffect(() => {
    if (!lastRefreshed) return;
    const tick = () => setCountdownPct(Math.max(0, 100 - ((Date.now() - lastRefreshed.getTime()) / REFRESH_MS) * 100));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [lastRefreshed]);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) { setIsPresenting(false); setIsPodium(false); }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ── Presentation mode ──────────────────────────────────────────────────────

  const enterPresentation = useCallback(async () => {
    setIsPresenting(true);
    await document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  const exitPresentation = useCallback(async () => {
    setIsPresenting(false);
    setIsPodium(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const positions = useMemo(() => sheet ? getUniquePositions(sheet.rows) : [], [sheet]);
  const result    = useMemo(() => {
    if (!sheet || !filters.metric) return null;
    return computeLeaderboard(sheet.rows, filters);
  }, [sheet, filters]);

  // Keep resultRef in sync so the rank-change effect can read it without
  // adding result to that effect's dependency array.
  resultRef.current = result;

  // ── Rank-change detection ──────────────────────────────────────────────────

  useEffect(() => {
    if (refreshing) {
      // Snapshot entries at the start of every refresh
      preRefreshSnapshot.current = resultRef.current?.entries ?? [];
    } else if (preRefreshSnapshot.current.length > 0 && resultRef.current) {
      // Refresh just finished — compare new ranks to snapshot
      const snapshot   = preRefreshSnapshot.current;
      const newEntries = resultRef.current.entries;
      preRefreshSnapshot.current = [];

      const prevMap = new Map(snapshot.map(e => [e.name, e.rank]));
      const changes = new Map<string, 'up' | 'down'>();
      newEntries.forEach(e => {
        const prev = prevMap.get(e.name);
        if (prev !== undefined && prev !== e.rank) {
          changes.set(e.name, e.rank < prev ? 'up' : 'down');
        }
      });
      if (changes.size > 0) {
        setRankChanges(changes);
        setTimeout(() => setRankChanges(new Map()), 8000);
      }

      // Detect rank-1 handover
      const oldTop = snapshot[0]?.name;
      const newTop = newEntries[0]?.name;
      if (oldTop && newTop && oldTop !== newTop) {
        setNewLeader(newTop);
        playNewLeaderSound();
        setTimeout(() => setNewLeader(null), 10500);
      }
    }
  }, [refreshing]);

  const secondsLeft = Math.ceil((countdownPct / 100) * (REFRESH_MS / 1000));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className={`min-h-screen ${isPresenting ? 'py-6 px-8' : 'py-10 px-4'}`}>

      {/* New-leader fullscreen announcement */}
      {newLeader && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
          <div className="leader-backdrop absolute inset-0" style={{ backgroundColor: 'rgba(8,14,26,0.8)' }} />
          <div className="leader-text relative text-center px-8">
            <p
              className="font-black uppercase text-yellow-400"
              style={{
                fontSize: 'clamp(3.5rem, 13vw, 11rem)',
                letterSpacing: '0.15em',
                textShadow: '0 0 60px rgba(251,191,36,0.9), 0 0 120px rgba(251,191,36,0.5), 0 0 200px rgba(251,191,36,0.25)',
              }}
            >
              New Leader!
            </p>
            <p
              className="mt-4 font-semibold uppercase text-yellow-100/70"
              style={{ fontSize: 'clamp(1.2rem, 3.5vw, 2.5rem)', letterSpacing: '0.45em' }}
            >
              {newLeader}
            </p>
          </div>
        </div>
      )}
      <div className={`mx-auto space-y-6 ${isPresenting ? 'w-full' : 'max-w-4xl'}`}>

        {/* Header */}
        <div className={`flex items-center gap-5 transition-opacity duration-300 ${isPresenting ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
          <Image src="/scotlandlogo.png" alt="Scotland" width={72} height={72} className="object-contain flex-shrink-0" priority />
          <div>
            <h1 className="font-mono text-2xl font-bold tracking-[0.25em] text-bip-accent uppercase">Scottish Rugby Leaderboard</h1>
            <p className="mt-1 text-xs tracking-widest text-bip-muted uppercase">Paste a Google Sheet URL (set to public) — columns required: Date, Name, Position — Add aditional columns for each metric you want a leaderboard for.</p>
          </div>
        </div>

        {/* URL form */}
        <section className={`bg-bip-surface rounded-lg border border-bip-border p-4 space-y-3 transition-all duration-300 ${isPresenting ? 'hidden' : ''}`}>
          <SheetUrlForm onSubmit={handleUrlSubmit} loading={loading} initialUrl={savedUrl} />
          {loading && <StatusMessage type="info" message="Fetching sheet data…" />}
          {error   && <StatusMessage type="error" message={error} />}
        </section>

        {sheet && (
          <>
            {/* Collapsible filter panel */}
            <section className={`bg-bip-surface rounded-lg border border-bip-border overflow-hidden transition-all duration-300 ${isPresenting ? 'hidden' : ''}`}>
              <button
                onClick={() => setFiltersOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-bip-panel/40 transition-colors duration-150"
              >
                <span className="text-xs font-semibold text-bip-muted uppercase tracking-widest">Filters</span>
                <IconChevron open={filtersOpen} />
              </button>
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${filtersOpen ? 'max-h-96 pb-4' : 'max-h-0'}`}>
                <div className="px-4">
                  <LeaderboardControls
                    metricColumns={sheet.metricColumns}
                    positions={positions}
                    filters={filters}
                    onChange={setFilters}
                  />
                </div>
              </div>
            </section>

            {/* Export-capturable region: presenting header + leaderboard */}
            <div ref={exportRef} className="space-y-6">

            {/* Presentation-mode header: logo + title */}
            {isPresenting && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <Image src="/scotlandlogo.png" alt="Scotland" width={80} height={80} className="object-contain flex-shrink-0" />
                  <div>
                    <p className="text-bip-muted text-sm font-semibold uppercase tracking-widest">Scottish Rugby</p>
                    <h1 className="font-mono text-4xl font-bold tracking-[0.25em] text-bip-accent uppercase">
                      {filters.metric} Leaderboard
                      <span className="text-lg font-semibold text-bip-muted tracking-widest ml-4 normal-case">
                        &middot; {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </h1>
                  </div>
                </div>
                {lastRefreshed && (
                  <span className="text-sm text-bip-muted font-mono">Updated {formatTime(lastRefreshed)}</span>
                )}
              </div>
            )}

            {/* Leaderboard panel */}
            <section className="bg-bip-surface rounded-lg border border-bip-border p-4">

              {/* Panel header */}
              <div className="flex items-center justify-between mb-3">
                {!isPresenting && (
                  <h2 className="text-sm font-semibold text-bip-text uppercase tracking-widest">
                    {filters.metric} Leaderboard
                  </h2>
                )}
                <div className={`flex items-center gap-3 ${isPresenting ? 'w-full justify-end' : ''}`}>
                  {lastRefreshed && !isPresenting && (
                    <span className="text-xs text-bip-muted font-mono hidden sm:inline">
                      Updated {formatTime(lastRefreshed)}
                    </span>
                  )}
                  <button
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    className="text-xs text-bip-accent hover:text-bip-accent/70 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors duration-150"
                  >
                    <span className={refreshing ? 'inline-block animate-spin' : 'inline-block'} aria-hidden>↻</span>
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                  </button>
                  {isPresenting && (
                    <button
                      onClick={() => setIsPodium(p => !p)}
                      disabled={!result || (result.entries.length < 3)}
                      className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                        isPodium
                          ? 'border-bip-accent/60 text-bip-accent'
                          : 'border-bip-border text-bip-muted hover:border-bip-accent/60 hover:text-bip-accent'
                      }`}
                    >
                      🏆 {isPodium ? 'Table' : 'Podium'}
                    </button>
                  )}
                  <button
                    onClick={exportPdf}
                    disabled={exporting || !result}
                    className="flex items-center gap-1.5 text-xs border border-bip-border text-bip-muted hover:border-bip-accent/60 hover:text-bip-accent px-2.5 py-1.5 rounded transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span aria-hidden>↓</span>
                    {exporting ? 'Exporting…' : 'Export PDF'}
                  </button>
                  <button
                    onClick={isPresenting ? exitPresentation : enterPresentation}
                    className="flex items-center gap-1.5 text-xs border border-bip-border text-bip-muted hover:border-bip-accent/60 hover:text-bip-accent px-2.5 py-1.5 rounded transition-colors duration-150"
                  >
                    {isPresenting ? <IconCollapse /> : <IconExpand />}
                    {isPresenting ? 'Exit' : 'Present'}
                  </button>
                </div>
              </div>

              {/* Refresh countdown */}
              {lastRefreshed && (
                <div className="mb-5 space-y-1">
                  <div className="h-px bg-bip-panel rounded-full overflow-hidden">
                    <div
                      className="h-full bg-bip-accent/40 rounded-full transition-[width] duration-200 ease-linear"
                      style={{ width: `${countdownPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-bip-muted/35">Next refresh</span>
                    <span className="text-[10px] text-bip-muted/35 font-mono">{secondsLeft}s</span>
                  </div>
                </div>
              )}

              {refreshError && (
                <div className="mb-3">
                  <StatusMessage type="warning" message={`Auto-refresh failed: ${refreshError}`} />
                </div>
              )}

              {result ? (
                result.entries.length === 0 && result.excludedCount === 0 ? (
                  <StatusMessage type="warning" message="No rows match the current filters." />
                ) : isPodium && isPresenting ? (
                  <PodiumView entries={result.entries} metric={filters.metric} />
                ) : (
                  <LeaderboardTable
                    entries={result.entries}
                    metric={filters.metric}
                    excludedCount={result.excludedCount}
                    sortDirection={filters.sortDirection}
                    rankChanges={rankChanges}
                    twoColumn={isPresenting}
                    newLeader={newLeader}
                  />
                )
              ) : (
                <StatusMessage type="info" message="Select a metric to view the leaderboard." />
              )}

            </section>
            </div>{/* /exportRef */}
          </>
        )}
      </div>
    </main>
  );
}
