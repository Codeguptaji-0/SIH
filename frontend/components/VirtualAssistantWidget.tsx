"use client";

import React, { useState } from 'react';
import { X, Send, Loader2, AlertTriangle } from 'lucide-react';
import { apiJson, ApiError } from '@/app/lib/api';

/**
 * Assistant chat widget.
 *
 * There is no canned answer in this file any more. The catch block used to
 * append a fabricated, authoritative-sounding reply about stratified sampling
 * and a made-up "NSSTA TPAC Module STAT-101" citation, so a 401, a stopped
 * backend or an AI provider failure all looked like a confident domain answer.
 * The response body was also read with `.json()` without checking `res.ok`,
 * which meant an error payload's missing `reply` rendered as an empty bubble.
 */

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  isError?: boolean;
  sources?: string[];
}

interface ChatResponse {
  reply: string;
  sources: string[];
}

const OPENING_MESSAGE: ChatMessage = {
  sender: 'bot',
  text: 'Ask a question about statistical methodology, survey sampling or the training catalogue.'
};

export const VirtualAssistantWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([OPENING_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const data = await apiJson<ChatResponse>('/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userMsg })
      });

      if (typeof data?.reply === 'string' && data.reply.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: data.reply,
            sources: Array.isArray(data.sources) ? data.sources : undefined
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: 'bot', isError: true, text: 'The assistant returned an empty response.' }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          isError: true,
          text:
            err instanceof ApiError
              ? `Assistant unavailable (HTTP ${err.status}): ${err.message}`
              : 'Assistant unavailable: the request did not reach the server.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex h-11 items-center gap-2 border border-ink bg-ink px-4 font-mono text-[11px] uppercase tracking-eyebrow text-paper transition-colors hover:bg-ink-soft"
        >
          Assistant
        </button>
      ) : (
        <div className="flex h-[420px] w-80 flex-col border-2 border-ink bg-white sm:w-96">
          <div className="flex items-start justify-between gap-3 border-b border-ink bg-paper-sunken px-4 py-3">
            <div className="min-w-0">
              <p className="eyebrow">Assistant</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Answers come from the server. Nothing is answered locally.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="shrink-0 text-slate-400 transition-colors hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Close assistant</span>
            </button>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto bg-paper px-4 py-3" aria-live="polite">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[86%] border-l-2 px-3 py-2 text-xs leading-relaxed ${
                    m.sender === 'user'
                      ? 'border-l-navy-600 bg-paper-sunken text-ink'
                      : m.isError
                      ? 'border-l-gap-600 bg-gap-50 text-gap-700'
                      : 'border-l-rule-strong bg-white text-slate-600'
                  }`}
                >
                  {m.isError && (
                    <AlertTriangle
                      className="-mt-0.5 mr-1 inline-block h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                  )}
                  {m.text}
                  {m.sources && m.sources.length > 0 && (
                    <p className="mt-1.5 border-t border-rule pt-1.5 font-mono text-[10px] text-slate-400">
                      Sources: {m.sources.join('; ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <p className="inline-flex items-center gap-2 border-l-2 border-l-rule-strong bg-white px-3 py-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Waiting for the server…
                </p>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 border-t border-rule bg-white px-3 py-2.5"
          >
            <label htmlFor="assistant-input" className="sr-only">
              Message the SkillSetu Assistant
            </label>
            <input
              id="assistant-input"
              name="assistant-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a statistical or training query…"
              className="h-9 flex-1 border border-rule-strong bg-white px-3 text-xs text-ink placeholder:text-slate-400 focus:border-navy-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex h-9 w-9 items-center justify-center border border-navy-600 bg-navy-600 text-paper transition-colors hover:bg-navy-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Send message</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
