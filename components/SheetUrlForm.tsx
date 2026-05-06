'use client';

import { useState } from 'react';

interface Props {
  onSubmit: (url: string) => void;
  loading: boolean;
  initialUrl?: string;
}

export default function SheetUrlForm({ onSubmit, loading, initialUrl = '' }: Props) {
  const [url, setUrl] = useState(initialUrl);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a public Google Sheet URL…"
        disabled={loading}
        className="flex-1 h-10 px-3 rounded border border-bip-border bg-bip-bg text-bip-text text-sm placeholder:text-bip-muted/50 focus:outline-none focus:ring-1 focus:ring-bip-accent disabled:opacity-40 disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="h-10 px-5 rounded bg-bip-accent text-bip-bg text-sm font-semibold tracking-wide hover:brightness-110 active:brightness-90 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {loading ? 'Loading…' : 'Load Sheet'}
      </button>
    </form>
  );
}
