'use client';

import { useState } from 'react';
import { Navbar } from '@/components/navbar';
import { ScanPanel, SafetyReportView, ChatPanel } from '@/components/scan-panel';
import type { SafetyReport } from '@/components/scan-panel';

export default function ScanPage() {
  const [report, setReport] = useState<SafetyReport | null>(null);
  const [chatSessionId, setChatSessionId] = useState<number | null>(null);

  function handleReportReady(r: SafetyReport, sessionId: number | null) {
    setReport(r);
    setChatSessionId(sessionId);
    // Scroll to results on mobile
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        document.getElementById('scan-results')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }

  function handleReset() {
    setReport(null);
    setChatSessionId(null);
  }

  return (
    <main className="relative min-h-screen overflow-hidden pb-16">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -left-32 top-12 h-72 w-72 rounded-full bg-[#00e5b0]/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-24 h-80 w-80 rounded-full bg-[#0070f3]/15 blur-[140px]" />

      <Navbar />

      <div className="mx-auto mt-8 w-[92%] max-w-7xl">
        {/* Without report: scanner is centered / full-width */}
        {!report ? (
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-white">Scan a product</h1>
              <p className="mt-2 text-sm text-white/60">
                Point your camera at a barcode, or enter one manually.
              </p>
            </div>
            <ScanPanel onReportReady={handleReportReady} />
          </div>
        ) : (
          /* With report: responsive grid — scanner+report left (2/3), chat right (1/3) */
          <div id="scan-results" className="grid gap-6 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
            {/* Left column: scanner + report */}
            <div className="space-y-6 min-w-0">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Scan another product</h2>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition"
                >
                  ↺ New scan
                </button>
              </div>
              <ScanPanel onReportReady={handleReportReady} />
              <SafetyReportView report={report} />
            </div>

            {/* Right column: chat — sticky on desktop */}
            <div className="lg:sticky lg:top-6 lg:self-start" style={{ height: 'calc(100vh - 5rem)' }}>
              {chatSessionId ? (
                <ChatPanel reportId={report.id} sessionId={chatSessionId} />
              ) : (
                <div className="flex h-full items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/40">
                  Chat unavailable — please sign in to continue the conversation.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
