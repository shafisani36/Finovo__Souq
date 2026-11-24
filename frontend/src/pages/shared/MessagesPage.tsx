import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, MessageSquare, Send } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState, ErrorState, LoadingState, SkeletonBlock } from '../../components/ui/States';
import { useAuth } from '../../features/auth/context/useAuth';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { conversationsService } from '../../services/conversations.service';
import type { Conversation, Message } from '../../types';
import { formatDate, formatPrice, formatRelative, formatTime } from '../../utils/format';

/** Polling keeps chats fresh until real-time delivery (Socket.IO) is approved and connected */
const POLL_MS = 15_000;
const MAX_LENGTH = 2000;

function Thread({ conversation, onSent }: { conversation: Conversation; onSent: () => void }) {
  const { user } = useAuth();
  const messages = useAsync(() => conversationsService.messages(conversation.id), [conversation.id]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => void messages.refresh(), POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.data?.length]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError('');
    try {
      const message = await conversationsService.send(conversation.id, body);
      messages.setData((prev) => [...(prev ?? []), message]);
      setDraft('');
      onSent();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const grouped = (messages.data ?? []).reduce<{ day: string; items: Message[] }[]>((groups, m) => {
    const day = formatDate(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
    return groups;
  }, []);

  return (
    <div className="thread">
      <div className="thread__head">
        <Link to="?" className="icon-btn icon-btn--sm show-md" aria-label="Back to conversations">
          <ArrowLeft size={16} />
        </Link>
        <Avatar name={conversation.counterpart.name} size="sm" />
        <div className="thread__head-text">
          <strong>{conversation.counterpart.name}</strong>
          <Link to={`/listings/${conversation.listingId}`} className="thread__listing">
            {conversation.listingTitle} - {formatPrice(conversation.listingPrice)}
          </Link>
        </div>
      </div>
      <div className="thread__messages" aria-live="polite">
        {messages.isLoading ? (
          <LoadingState label="Loading messages..." />
        ) : messages.error ? (
          <ErrorState error={messages.error} onRetry={messages.reload} />
        ) : grouped.length === 0 ? (
          <p className="text-muted thread__empty">Say hello and ask about the ad.</p>
        ) : (
          grouped.map((group) => (
            <div key={group.day}>
              <p className="thread__day">{group.day}</p>
              {group.items.map((m) => (
                <div key={m.id} className={`bubble${m.senderId === user?.id ? ' bubble--mine' : ''}`}>
                  <p>{m.body}</p>
                  <time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form className="thread__composer" onSubmit={send}>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        <div className="thread__composer-row">
          <label className="sr-only" htmlFor="message-input">
            Message
          </label>
          <textarea
            id="message-input"
            className="textarea"
            rows={1}
            value={draft}
            maxLength={MAX_LENGTH}
            placeholder="Write a message..."
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button type="submit" className="btn btn--primary thread__send" disabled={sending || !draft.trim()} aria-label="Send message">
            {sending ? <span className="btn__spinner" /> : <Send size={18} />}
          </button>
        </div>
        <p className="field__hint">For your safety, keep chats on Finovo Souq and never share bank details.</p>
      </form>
    </div>
  );
}

export function MessagesPage() {
  useDocumentTitle('Messages');
  const [searchParams] = useSearchParams();
  const activeId = searchParams.get('c');
  const conversations = useAsync(() => conversationsService.list(), []);

  useEffect(() => {
    const id = window.setInterval(() => void conversations.refresh(), POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opening a chat clears its unread counter locally
  useEffect(() => {
    if (activeId) conversations.setData((prev) => prev?.map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c)) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, conversations.data?.length]);

  const active = conversations.data?.find((c) => c.id === activeId) ?? null;

  return (
    <>
      <PageHeader title="Messages" subtitle="Conversations are private between you and the other person." />
      <div className={`messages card${active ? ' messages--open' : ''}`}>
        <aside className="messages__list" aria-label="Conversations">
          {conversations.error ? (
            <ErrorState error={conversations.error} onRetry={conversations.reload} />
          ) : conversations.isLoading || !conversations.data ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonBlock key={i} height={64} />
              ))}
            </div>
          ) : conversations.data.length === 0 ? (
            <EmptyState icon={<MessageSquare size={26} />} title="No conversations" text="Messages about ads will appear here." />
          ) : (
            <ul>
              {conversations.data.map((c) => (
                <li key={c.id}>
                  <Link to={`?c=${c.id}`} className={`conversation${c.id === activeId ? ' is-active' : ''}`} aria-current={c.id === activeId ? 'true' : undefined}>
                    <Avatar name={c.counterpart.name} size="sm" />
                    <span className="conversation__body">
                      <span className="preview-list__row">
                        <strong>{c.counterpart.name}</strong>
                        <span className="preview-list__time">{formatRelative(c.lastMessageAt)}</span>
                      </span>
                      <span className="preview-list__sub">{c.listingTitle}</span>
                      <span className={`preview-list__text${c.unreadCount ? ' preview-list__text--unread' : ''}`}>{c.lastMessage || 'No messages yet'}</span>
                    </span>
                    {c.unreadCount > 0 && <span className="count-pill">{c.unreadCount}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="messages__thread">
          {active ? (
            <Thread key={active.id} conversation={active} onSent={() => void conversations.refresh()} />
          ) : (
            <EmptyState icon={<MessageSquare size={26} />} title="Select a conversation" text="Choose a chat on the left to read and reply." />
          )}
        </section>
      </div>
    </>
  );
}
