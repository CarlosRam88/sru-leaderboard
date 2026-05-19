'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import LeaderboardControls from '@/components/LeaderboardControls';
import LeaderboardTable from '@/components/LeaderboardTable';
import MultiView from '@/components/MultiView';
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
  regionFilter: '',
  mode: 'best',
  topN: null,
};

const REFRESH_MS = 15_000;

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

  const [exporting, setExporting]       = useState(false);
  const [presentView, setPresentView]   = useState<'table' | 'podium' | 'multi'>('table');

  const csvUrlRef          = useRef<string | null>(null);
  const resultRef          = useRef<LeaderboardResult | null>(null);
  const preRefreshSnapshot = useRef<LeaderboardEntry[]>([]);
  const exportRef          = useRef<HTMLDivElement>(null);
  csvUrlRef.current = csvUrl;

  // ── New-leader sound: low brass glissando with cathedral reverb ─────────────

  function playNewLeaderSound() {
    try {
      if (activeCtx) return; // already playing — don't double-trigger
      const ctx = new AudioContext();
      activeCtx = ctx;
      const now = ctx.currentTime;
      const dur = 2.5;   // 30% shorter than original 3.4 s
      const end = now + dur;

      // Cathedral reverb — 3.8 s IR
      const revLen = Math.floor(ctx.sampleRate * 3.8);
      const revBuf = ctx.createBuffer(2, revLen, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const ch = revBuf.getChannelData(c);
        for (let i = 0; i < revLen; i++)
          ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / revLen, 1.15);
      }
      const reverb  = ctx.createConvolver(); reverb.buffer = revBuf;
      const revSend = ctx.createGain(); revSend.gain.value = 0.82;
      revSend.connect(reverb); reverb.connect(ctx.destination);

      // Breathy attack noise — fades in then dissolves into the tone
      const bLen  = Math.floor(ctx.sampleRate * 0.52);
      const bBuf  = ctx.createBuffer(1, bLen, ctx.sampleRate);
      const bData = bBuf.getChannelData(0);
      for (let i = 0; i < bLen; i++) bData[i] = Math.random() * 2 - 1;
      const bSrc = ctx.createBufferSource(); bSrc.buffer = bBuf;
      const bFlt = ctx.createBiquadFilter();
      bFlt.type = 'bandpass'; bFlt.frequency.value = 680; bFlt.Q.value = 1.4;
      const bEnv = ctx.createGain();
      bEnv.gain.setValueAtTime(0,    now);
      bEnv.gain.linearRampToValueAtTime(0.22, now + 0.10);
      bEnv.gain.linearRampToValueAtTime(0.04, now + 0.38);
      bEnv.gain.linearRampToValueAtTime(0,    now + 0.52);
      bSrc.connect(bFlt); bFlt.connect(bEnv);
      bEnv.connect(ctx.destination); bEnv.connect(revSend);
      bSrc.start(now);

      // Vibrato LFO — delayed, real players don't vibrate during the attack
      const lfo     = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 4.7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0, now);
      lfoGain.gain.linearRampToValueAtTime(0, now + 0.52);
      lfoGain.gain.linearRampToValueAtTime(5, now + 1.05);
      lfo.connect(lfoGain);
      lfo.start(now); lfo.stop(end + 0.1);

      // Continuous glide: F2 (87 Hz) → Eb3 (155 Hz)
      const freqLo   = 87;
      const freqHi   = 155;
      const glideAt  = now + 0.06;
      const glideEnd = now + 1.65;

      // Brass body: 4 detuned sawtooths → formant boost → lowpass
      const brassEnv = ctx.createGain();
      brassEnv.gain.setValueAtTime(0,    now);
      brassEnv.gain.linearRampToValueAtTime(0.70, now + 0.21);
      brassEnv.gain.setValueAtTime(0.70, now + 1.9);
      brassEnv.gain.linearRampToValueAtTime(0,    end);

      const formant = ctx.createBiquadFilter();
      formant.type = 'peaking'; formant.frequency.value = 350; formant.gain.value = 5; formant.Q.value = 1.1;

      const brassLp = ctx.createBiquadFilter();
      brassLp.type = 'lowpass'; brassLp.frequency.value = 1050; brassLp.Q.value = 0.75;

      brassEnv.connect(formant); formant.connect(brassLp);
      brassLp.connect(ctx.destination); brassLp.connect(revSend);

      [-22, -7, 7, 22].forEach(cents => {
        const osc = ctx.createOscillator(); osc.type = 'sawtooth';
        osc.detune.value = cents;
        lfoGain.connect(osc.detune);
        osc.frequency.setValueAtTime(freqLo, glideAt);
        osc.frequency.exponentialRampToValueAtTime(freqHi, glideEnd);
        osc.connect(brassEnv);
        osc.start(now); osc.stop(end + 0.1);
      });

      // Weight layer: 2 heavily lowpassed sawtooths for sub mass
      const wtEnv = ctx.createGain();
      wtEnv.gain.setValueAtTime(0,    now);
      wtEnv.gain.linearRampToValueAtTime(0.55, now + 0.29);
      wtEnv.gain.setValueAtTime(0.55, now + 1.9);
      wtEnv.gain.linearRampToValueAtTime(0,    end);

      const wtLp = ctx.createBiquadFilter();
      wtLp.type = 'lowpass'; wtLp.frequency.value = 310;
      wtEnv.connect(wtLp);
      wtLp.connect(ctx.destination); wtLp.connect(revSend);

      [-5, 5].forEach(cents => {
        const osc = ctx.createOscillator(); osc.type = 'sawtooth';
        osc.detune.value = cents;
        osc.frequency.setValueAtTime(freqLo, glideAt);
        osc.frequency.exponentialRampToValueAtTime(freqHi, glideEnd);
        osc.connect(wtEnv);
        osc.start(now); osc.stop(end + 0.1);
      });

      setTimeout(() => {
        ctx.close();
        if (activeCtx === ctx) activeCtx = null;
      }, (dur + 3.5) * 1000);
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
      const pdf     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfW    = pdf.internal.pageSize.getWidth();   // 297mm
      const pdfH    = pdf.internal.pageSize.getHeight();  // 210mm

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
      if (!document.fullscreenElement) { setIsPresenting(false); setPresentView('table'); }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ── Presentation mode ──────────────────────────────────────────────────────

  const handleNewLeader = useCallback((name: string) => {
    setNewLeader(name);
    playNewLeaderSound();
    setTimeout(() => setNewLeader(null), 10500);
  }, []);

  const enterPresentation = useCallback(async () => {
    setIsPresenting(true);
    await document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  const exitPresentation = useCallback(async () => {
    setIsPresenting(false);
    setPresentView('table');
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
        setTimeout(() => setRankChanges(new Map()), 30000);
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
                    regions={sheet.regions}
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
                    <>
                      <button
                        onClick={() => setPresentView(v => v === 'podium' ? 'table' : 'podium')}
                        disabled={!result || result.entries.length < 3}
                        className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                          presentView === 'podium'
                            ? 'border-bip-accent/60 text-bip-accent'
                            : 'border-bip-border text-bip-muted hover:border-bip-accent/60 hover:text-bip-accent'
                        }`}
                      >
                        🏆 {presentView === 'podium' ? 'Table' : 'Podium'}
                      </button>
                      <button
                        onClick={() => setPresentView(v => v === 'multi' ? 'table' : 'multi')}
                        className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded transition-colors duration-150 ${
                          presentView === 'multi'
                            ? 'border-bip-accent/60 text-bip-accent'
                            : 'border-bip-border text-bip-muted hover:border-bip-accent/60 hover:text-bip-accent'
                        }`}
                      >
                        ⊞ {presentView === 'multi' ? 'Table' : 'Multi'}
                      </button>
                    </>
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

              {isPresenting && presentView === 'multi' ? (
                <MultiView sheet={sheet} allPositions={positions} onNewLeader={handleNewLeader} />
              ) : result ? (
                result.entries.length === 0 && result.excludedCount === 0 ? (
                  <StatusMessage type="warning" message="No rows match the current filters." />
                ) : isPresenting && presentView === 'podium' ? (
                  <PodiumView entries={result.entries} metric={filters.metric} />
                ) : (
                  <LeaderboardTable
                    entries={result.entries}
                    metric={filters.metric}
                    excludedCount={result.excludedCount}
                    sortDirection={filters.sortDirection}
                    rankChanges={rankChanges}
                    twoColumn={isPresenting && presentView === 'table'}
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
