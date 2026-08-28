"use client";

import React, { useState } from 'react';
import { Bot, X, Send, Sparkles, AlertTriangle } from 'lucide-react';
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
          className="bg-blue-600 hover:bg-blue-700 text-white p-3.5 rounded-full shadow-xl flex items-center gap-2 font-medium text-xs border border-blue-400/40 transition-all hover:scale-105"
        >
          <Bot className="w-5 h-5 animate-bounce" aria-hidden="true" />
          <span className="hidden sm:inline font-semibold">SkillSetu Assistant</span>
          <span className="sr-only sm:hidden">Open SkillSetu Assistant</span>
        </button>
      ) : (
        <div className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col h-[420px] overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 text-white p-3.5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <Bot className="w-4 h-4 text-white" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xs font-bold">SkillSetu Assistant</h2>
                <p className="text-[10px] text-blue-300 font-mono">Statistical training queries</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Close assistant</span>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50 text-xs" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[82%] p-2.5 rounded-xl leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none font-medium'
                      : m.isError
                      ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-bl-none'
                      : 'bg-white text-slate-800 border border-slate-200 shadow-sm rounded-bl-none'
                  }`}
                >
                  {m.isError && (
                    <AlertTriangle className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" aria-hidden="true" />
                  )}
                  {m.text}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                      Sources: {m.sources.join('; ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-slate-400 text-xs flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-blue-600" aria-hidden="true" />
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-2 bg-white border-t border-slate-200 flex items-center gap-1.5">
            <label htmlFor="assistant-input" className="sr-only">
              Message the SkillSetu Assistant
            </label>
            <input
              id="assistant-input"
              name="assistant-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a statistical or training query..."
              className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Send message</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};


