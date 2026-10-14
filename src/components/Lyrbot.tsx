'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';

// Lyrbot: the floating help assistant, as on Lyrshop. A robot button opens a chat answered by
// /api/assistant/chat, with quick questions and WhatsApp/email contact for a person.
// The chat lasts for the browser tab.

const STORAGE_KEY = 'lyrbotChat';
const WHATSAPP_URL = 'https://wa.me/16615809465';
const WHATSAPP_LABEL = '+1 661 580 9465';
const SUPPORT_EMAIL = 'support@lyrtrip.com';
const GREETING = "Hi, I'm Lyrbot! Ask me about flights, hotels, bookings, refunds or your Lyrtrip account.";
const QUICK_QUESTIONS = [
  'Where is my e-ticket?',
  'How do hotel bookings work?',
  'Can I get a refund?',
  'How do I reset my password?',
];
const CONNECT_ERROR = `I couldn't connect just now. You can reach our team on WhatsApp ${WHATSAPP_LABEL} or at ${SUPPORT_EMAIL}.`;

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type Bubble = ChatMessage & { error?: boolean };

function RobotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <line x1="16" y1="3" x2="16" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="3" r="1.8" fill="currentColor" />
      <rect x="6" y="8" width="20" height="16" rx="5" fill="currentColor" />
      <rect x="2.5" y="13" width="3" height="6" rx="1.5" fill="currentColor" />
      <rect x="26.5" y="13" width="3" height="6" rx="1.5" fill="currentColor" />
      <circle cx="12" cy="15.5" r="2.2" className="fill-brand-600 lyrbot-eye" />
      <circle cx="20" cy="15.5" r="2.2" className="fill-brand-600 lyrbot-eye" />
      <path d="M12 20.2q4 2.6 8 0" fill="none" strokeWidth="1.8" strokeLinecap="round" className="stroke-brand-600" />
      <rect x="11" y="25" width="10" height="4" rx="2" fill="currentColor" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="w-4 h-4 shrink-0">
      <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

// Links, lyrtrip.com paths, emails and the WhatsApp number become anchors; everything else stays text.
const LINK_PATTERN =
  /(https?:\/\/[^\s<]+[^\s<.,;:!?)])|(lyrtrip\.com\/[\w./-]*\w)|([\w.+-]+@[\w-]+\.[\w.-]*\w)|(\+1[\s-]?661[\s-]?580[\s-]?9465)/g;

function formatReply(text: string): ReactNode {
  return text.split('\n').map((line, lineIndex) => {
    const parts: ReactNode[] = [];
    let last = 0;
    for (const match of line.matchAll(LINK_PATTERN)) {
      const [whole, url, sitePath, email, phone] = match;
      const start = match.index ?? 0;
      if (start > last) parts.push(line.slice(last, start));
      const linkClass = 'underline font-medium text-brand-700 break-words';
      if (url) parts.push(<a key={start} href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>{url}</a>);
      else if (sitePath) parts.push(<a key={start} href={`https://${sitePath}`} className={linkClass}>{sitePath}</a>);
      else if (email) parts.push(<a key={start} href={`mailto:${email}`} className={linkClass}>{email}</a>);
      else if (phone) parts.push(<a key={start} href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>{phone}</a>);
      last = start + whole.length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return (
      <Fragment key={lineIndex}>
        {lineIndex > 0 && <br />}
        {parts}
      </Fragment>
    );
  });
}

function readHistory(): ChatMessage[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveHistory(history: ChatMessage[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-30)));
  } catch {
    // Private browsing can block storage; the chat still works for this page view.
  }
}

export default function Lyrbot() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const box = messagesRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [history, failure, busy, open]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    const asked: ChatMessage[] = [...history, { role: 'user', content: text }];
    setHistory(asked);
    saveHistory(asked);
    setFailure(null);
    setBusy(true);
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: asked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) throw new Error(data.error || '');
      const answered: ChatMessage[] = [...asked, { role: 'assistant', content: data.reply }];
      setHistory(answered);
      saveHistory(answered);
    } catch (err) {
      // Drop the unanswered question so a retry doesn't send it twice.
      setHistory(history);
      saveHistory(history);
      setFailure((err as Error).message || CONNECT_ERROR);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const bubbles: Bubble[] = [
    { role: 'assistant', content: GREETING },
    ...history,
    ...(failure ? [{ role: 'assistant' as const, content: failure, error: true }] : []),
  ];

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <section
          id="lyrbot-panel"
          role="dialog"
          aria-label="Lyrbot AI assistant"
          className="lyrbot-panel flex flex-col w-[min(370px,calc(100vw-2rem))] h-[min(540px,calc(100dvh-8rem))] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden"
        >
          <header className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-white/20">
              <RobotIcon className="w-6 h-6" />
            </span>
            <div className="flex-1 leading-tight">
              <strong className="block">Lyrbot</strong>
              <small className="text-xs opacity-90">AI assistant · replies in seconds</small>
            </div>
            <button
              type="button"
              onClick={() => { setOpen(false); toggleRef.current?.focus(); }}
              aria-label="Close Lyrbot"
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 text-2xl leading-none"
            >
              &times;
            </button>
          </header>

          <div ref={messagesRef} aria-live="polite" className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {bubbles.map((b, i) => (
              <div
                key={i}
                className={`max-w-[85%] w-fit px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                  b.role === 'user'
                    ? 'ml-auto bg-btn text-white rounded-br-md'
                    : b.error
                      ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-md'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                }`}
              >
                {b.role === 'user' ? b.content : formatReply(b.content)}
              </div>
            ))}
            {busy && (
              <div className="w-fit px-3 py-2.5 rounded-2xl rounded-bl-md bg-white border border-gray-200" aria-label="Lyrbot is typing">
                <span className="lyrbot-typing flex gap-1"><i /><i /><i /></span>
              </div>
            )}
          </div>

          {history.length === 0 && !busy && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2 bg-gray-50" aria-label="Suggested questions">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={e => { e.preventDefault(); const text = draft; setDraft(''); void ask(text); }}
            className="flex gap-2 p-3 border-t border-gray-200"
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              maxLength={1000}
              placeholder="Ask Lyrbot a question…"
              aria-label="Your question"
              autoComplete="off"
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={busy}
              aria-label="Send"
              className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-btn hover:bg-btn-hover text-white disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.3 10l12.6 2-12.6 2z" /></svg>
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-3 text-xs text-gray-500">
            <span>Prefer a person?</span>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-green-700 hover:underline">
              <WhatsAppIcon /> WhatsApp {WHATSAPP_LABEL}
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-brand-700 hover:underline">{SUPPORT_EMAIL}</a>
          </div>
        </section>
      )}

      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls="lyrbot-panel"
        aria-label={open ? 'Close Lyrbot' : 'Open Lyrbot, AI assistant'}
        className={`lyrbot-toggle inline-flex items-center gap-1.5 h-13 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white font-bold shadow-lg shadow-brand-600/30 hover:-translate-y-0.5 hover:shadow-xl transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 ${open ? 'px-2.5' : 'pl-2.5 pr-4'}`}
      >
        <RobotIcon className="w-8 h-8" />
        {!open && <span>Lyrbot</span>}
      </button>
    </div>
  );
}
