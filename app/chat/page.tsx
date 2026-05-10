'use client';

import { useEffect, useRef, useState } from 'react';

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type SendResponse = {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  sessionTitle: string | null;
};

const styles = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; background: #fafafa; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; }
  .root { display: flex; flex-direction: column; height: 100vh; max-width: 720px; margin: 0 auto; background: #ffffff; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
  header { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-weight: 600; background: #ffffff; position: sticky; top: 0; }
  header .sub { font-weight: 400; font-size: 12px; color: #6b7280; margin-top: 2px; }
  .scroll { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #fafafa; }
  .empty { color: #9ca3af; text-align: center; margin-top: 60px; font-size: 14px; }
  .bubble { max-width: 85%; padding: 10px 14px; border-radius: 14px; line-height: 1.5; font-size: 14px; white-space: pre-wrap; word-wrap: break-word; }
  .bubble.user { align-self: flex-end; background: #2563eb; color: #ffffff; border-bottom-right-radius: 4px; }
  .bubble.assistant { align-self: flex-start; background: #ffffff; border: 1px solid #e5e7eb; color: #111827; border-bottom-left-radius: 4px; }
  .bubble.thinking { align-self: flex-start; color: #6b7280; font-style: italic; background: transparent; border: none; }
  .err { padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #991b1b; font-size: 13px; }
  form { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid #e5e7eb; background: #ffffff; }
  textarea { flex: 1; resize: none; border: 1px solid #d1d5db; border-radius: 10px; padding: 10px 12px; font-family: inherit; font-size: 14px; line-height: 1.4; min-height: 42px; max-height: 140px; outline: none; }
  textarea:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
  button { padding: 0 18px; border: none; border-radius: 10px; background: #2563eb; color: #ffffff; font-weight: 500; font-size: 14px; cursor: pointer; }
  button:disabled { background: #9ca3af; cursor: not-allowed; }
`;

function parseReportsParam(): number[] {
  if (typeof window === 'undefined') return [];
  const u = new URL(window.location.href);
  const fromList = u.searchParams.get('reports');
  if (fromList) {
    return fromList
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 3);
  }
  const single = u.searchParams.get('reportId');
  if (single) {
    const n = Number.parseInt(single, 10);
    if (Number.isFinite(n) && n > 0) return [n];
  }
  return [];
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusReports, setFocusReports] = useState<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFocusReports(parseReportsParam());
  }, []);

  useEffect(() => {
    if (sessionId !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/chat/sessions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`Could not start session: ${res.status}`);
        const data = (await res.json()) as { id: number; title: string | null };
        if (!cancelled) {
          setSessionId(data.id);
          setTitle(data.title);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to start chat');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, sending]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || !sessionId || sending) return;
    const content = input.trim();
    setInput('');
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content,
          ...(focusReports.length ? { reports: focusReports } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Send failed: ${res.status}`);
      }
      const data = (await res.json()) as SendResponse;
      setMessages((prev) => [...prev, data.userMessage, data.assistantMessage]);
      if (data.sessionTitle && !title) setTitle(data.sessionTitle);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="root">
        <header>
          {title ?? 'SafeScan Assistant'}
          <div className="sub">
            {focusReports.length
              ? `Focused on report${focusReports.length > 1 ? 's' : ''}: ${focusReports.join(', ')}`
              : 'Ask anything about your scans, allergens, or medication interactions'}
          </div>
        </header>
        <div className="scroll" ref={scrollRef}>
          {messages.length === 0 && !sending && (
            <div className="empty">Ask a follow-up question to get started.</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role}`}>
              {m.content}
            </div>
          ))}
          {sending && <div className="bubble thinking">Thinking…</div>}
          {error && <div className="err">{error}</div>}
        </div>
        <form onSubmit={handleSend}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              sessionId ? 'Type a question… (Enter to send, Shift+Enter for new line)' : 'Starting…'
            }
            disabled={!sessionId || sending}
            rows={1}
          />
          <button type="submit" disabled={!input.trim() || !sessionId || sending}>
            Send
          </button>
        </form>
      </div>
    </>
  );
}
