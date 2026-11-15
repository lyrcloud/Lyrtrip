'use client';

import { useState } from 'react';

export interface ThreadMessage { id: string; at: string; who: string; text: string; attachments: number }

// The messages between an applicant and the employer or institution, relayed by Lyrtrip, and a box to write back
export default function AppConversation({ thread, canMessage, party, onSend }: {
  thread: ThreadMessage[]; canMessage: boolean; party: 'employer' | 'institution'; onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const who: Record<string, string> = { employer: 'Employer', institution: 'Institution', applicant: 'You', lyrtrip: 'Lyrtrip' };
  const send = async () => {
    setBusy(true);
    try {
      await onSend(text);
      setText('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not send the message');
    }
    setBusy(false);
  };
  return (
    <div className="mt-2 space-y-2">
      {thread.map(m => (
        <div key={m.id} className={`rounded-lg p-2 ${m.who === 'applicant' ? 'bg-brand-50 ml-6' : m.who === party ? 'bg-teal-50 mr-6' : 'bg-gray-50'}`}>
          <p className="text-xs text-gray-500">{who[m.who] ?? m.who} · {new Date(m.at).toLocaleString()}</p>
          <p className="text-gray-800 whitespace-pre-line">{m.text}</p>
          {m.attachments > 0 && <p className="text-xs text-gray-500">{m.attachments} attachment(s) held by Lyrtrip</p>}
        </div>
      ))}
      {canMessage && (
        <div className="flex gap-2">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={4000} placeholder={`Write to the ${party}…`}
            className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500" />
          <button onClick={send} disabled={busy || text.trim().length < 2} className="self-end px-3 py-2 bg-btn text-white rounded-xl text-sm font-semibold disabled:bg-gray-300">
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}
    </div>
  );
}
