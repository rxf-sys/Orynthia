import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Sparkles, Loader2, User, Bot, AlertTriangle } from 'lucide-react';
import { chatApi } from '@/lib/api';
import { Card, Btn, PageHead, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Wie viel habe ich diesen Monat für Lebensmittel ausgegeben?',
  'Welche Abos kosten mich am meisten?',
  'Wo kann ich am ehesten sparen?',
  'Komme ich mit meinen Budgets aus?',
];

export function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery({
    queryKey: ['chat-status'],
    queryFn: () => chatApi.status().then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || pending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setPending(true);
    try {
      const res = await chatApi.send(next);
      setMessages([...next, { role: 'assistant', content: res.data.content }]);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Antwort konnte nicht geladen werden';
      toast.error(msg);
      setMessages(next.slice(0, -1));
      setInput(text);
    } finally {
      setPending(false);
    }
  };

  if (status && !status.enabled) {
    return (
      <div className="space-y-5">
        <PageHead title="Finanz-Assistent" sub="Stelle Fragen zu deinen Finanzen in natürlicher Sprache" />
        <Card style={{ borderColor: 'var(--warn)' }}>
          <div className="flex items-start gap-3">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md"
              style={{ background: 'rgba(181, 120, 15, 0.12)', color: 'var(--warn)' }}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink">KI-Assistent nicht konfiguriert</h3>
              <p className="mt-1 text-sm text-ink-3">
                Setze <code className="rounded bg-soft px-1">ANTHROPIC_API_KEY</code> in deiner{' '}
                <code className="rounded bg-soft px-1">.env</code> und starte den Backend-Container neu, um den
                Assistenten zu aktivieren. Einen API-Schlüssel erhältst du auf{' '}
                <a
                  href="https://console.anthropic.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-indigo hover:underline"
                >
                  console.anthropic.com
                </a>
                .
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col gap-4">
      <PageHead title="Finanz-Assistent" sub="Stelle Fragen zu deinen Finanzen in natürlicher Sprache" />

      <Card className="flex flex-1 flex-col !p-0 overflow-hidden">
        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {messages.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Wie kann ich helfen?"
              description="Frag mich zu Ausgaben, Budgets, Verträgen, Sparzielen – ich antworte auf Basis deiner aktuellen Daten."
            />
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <MessageBubble key={i} message={m} />
              ))}
              {pending && (
                <div className="flex items-center gap-2 text-sm text-ink-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Orynthia AI denkt nach …
                </div>
              )}
            </div>
          )}
        </div>

        {messages.length === 0 && (
          <div className="border-t border-line px-4 py-3 sm:px-6">
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
              Vorschläge
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={pending}
                  className="rounded-pill border border-line bg-soft px-3 py-1.5 text-xs text-ink-2 transition hover:border-peach hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 border-t border-line px-4 py-3 sm:px-6"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Stelle eine Frage zu deinen Finanzen…"
            className="input flex-1 resize-none min-h-[44px] max-h-40"
            disabled={pending}
            autoFocus
          />
          <Btn variant="grad" type="submit" icon={Send} disabled={pending || !input.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Senden'}
          </Btn>
        </form>
      </Card>

      <p className="text-center text-xs text-ink-3">
        KI-Antworten können Fehler enthalten. Prüfe wichtige Aussagen mit deinen tatsächlichen Daten.
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
        style={{
          background: isUser ? 'var(--grad-soft)' : 'rgba(66, 71, 105, 0.12)',
          color: isUser ? 'var(--peach-2)' : 'var(--indigo)',
        }}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-wrap break-words rounded-lg px-3.5 py-2.5 text-sm leading-relaxed',
          isUser ? 'text-white' : 'border border-line bg-elev text-ink',
        )}
        style={isUser ? { background: 'var(--indigo)' } : undefined}
      >
        {message.content}
      </div>
    </div>
  );
}
