import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowLeft, ExternalLink, ImagePlus, MessageSquare, Mic, Search, Send, ShieldAlert, ShieldCheck, Trash2, UserX } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { MAX_VOICE_SECONDS, useVoiceRecorder, type VoiceRecording } from '../../components/chat/useVoiceRecorder';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { iconForSlug } from '../../components/listings/category-icons';
import { CategoryIcon } from '../../components/listings/CategoryIcon';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, LoadingState, SkeletonBlock } from '../../components/ui/States';
import { useAuth } from '../../features/auth/context/useAuth';
import { useSocket, useSocketEvent } from '../../features/realtime/realtime-context';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { conversationsService } from '../../services/conversations.service';
import type { Conversation, Message } from '../../types';
import { formatDate, formatPrice, formatRelative } from '../../utils/format';

const MAX_LENGTH = 2000;
const TYPING_SHOWN_MS = 3000;
const TYPING_SENT_EVERY_MS = 1500;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Adds or replaces a message by id, keeping the list in time order */
const upsertMessage = (list: Message[], message: Message) =>
  list.some((m) => m.id === message.id) ? list.map((m) => (m.id === message.id ? message : m)) : [...list, message];

function ListingThumb({ conversation }: { conversation: Conversation }) {
  return conversation.listingPhotoUrl ? (
    <img className="chat-thumb" src={conversation.listingPhotoUrl} alt="" />
  ) : (
    <span className="chat-thumb chat-thumb--empty">
      <CategoryIcon icon={iconForSlug(conversation.listingCategorySlug)} size={18} />
    </span>
  );
}

interface ThreadProps {
  conversation: Conversation;
  onConversation: (conversation: Conversation) => void;
}

function Thread({ conversation, onConversation }: ThreadProps) {
  const { user } = useAuth();
  const socket = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef<number | undefined>(undefined);
  const [viewer, setViewer] = useState<string | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const lastTypingSent = useRef(0);
  const stickToBottom = useRef(true);
  const blocked = conversation.blockedByMe || conversation.blockedByThem;

  // Latest page; loading it also marks the conversation as read on the server
  useEffect(() => {
    let active = true;
    conversationsService
      .messages(conversation.id)
      .then((page) => {
        if (!active) return;
        stickToBottom.current = true;
        setMessages(page.items);
        setHasMore(page.hasMore);
      })
      .catch((err: unknown) => active && setLoadError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [conversation.id]);

  // New messages scroll into view only when the reader is already at the bottom
  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => () => window.clearTimeout(typingTimer.current), []);

  const showTyping = (on: boolean) => {
    window.clearTimeout(typingTimer.current);
    setIsTyping(on);
    if (on) typingTimer.current = window.setTimeout(() => setIsTyping(false), TYPING_SHOWN_MS);
  };

  useSocketEvent('message:new', ({ message }) => {
    if (message.conversationId !== conversation.id) return;
    setMessages((list) => upsertMessage(list, message));
    if (message.senderId !== user?.id) {
      showTyping(false);
      if (document.visibilityState === 'visible') void conversationsService.markRead(conversation.id).catch(() => undefined);
    }
  });
  useSocketEvent('message:deleted', ({ message }) => {
    if (message.conversationId === conversation.id) setMessages((list) => upsertMessage(list, message));
  });
  useSocketEvent('typing', ({ conversationId }) => {
    if (conversationId === conversation.id) showTyping(true);
  });

  const loadOlder = async () => {
    const el = listRef.current;
    const previousHeight = el?.scrollHeight ?? 0;
    try {
      const page = await conversationsService.messages(conversation.id, messages[0]?.id);
      stickToBottom.current = false;
      setMessages((list) => [...page.items, ...list]);
      setHasMore(page.hasMore);
      // Keep the message the reader was looking at in the same place
      requestAnimationFrame(() => el && (el.scrollTop = el.scrollHeight - previousHeight));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const deliver = async (request: () => Promise<Message>) => {
    setSending(true);
    setError('');
    try {
      stickToBottom.current = true;
      const message = await request();
      setMessages((list) => upsertMessage(list, message));
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setSending(false);
    }
  };

  const sendText = async (event?: FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    if (await deliver(() => conversationsService.send(conversation.id, body))) setDraft('');
  };

  const sendPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError('Send a JPG, PNG or WebP photo.');
    if (file.size > MAX_PHOTO_BYTES) return setError('Photos can be up to 8 MB.');
    void deliver(() => conversationsService.sendAttachment(conversation.id, file, 'image'));
  };

  const recorder = useVoiceRecorder(({ blob, seconds }: VoiceRecording) => {
    void deliver(() => conversationsService.sendAttachment(conversation.id, blob, 'voice', seconds));
  });

  const onDraftChange = (value: string) => {
    setDraft(value);
    const now = Date.now();
    if (value && socket && now - lastTypingSent.current > TYPING_SENT_EVERY_MS) {
      lastTypingSent.current = now;
      socket.emit('typing', { conversationId: conversation.id });
    }
  };

  const deleteMessage = async (message: Message) => {
    try {
      const updated = await conversationsService.deleteMessage(conversation.id, message.id);
      setMessages((list) => upsertMessage(list, updated));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const toggleBlock = async () => {
    try {
      await conversationsService.setBlocked(conversation.id, !conversation.blockedByMe);
      onConversation({ ...conversation, blockedByMe: !conversation.blockedByMe });
      setBlockOpen(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const readUntil = conversation.counterpartLastReadAt ?? '';
  const days = messages.reduce<{ day: string; items: Message[] }[]>((groups, m) => {
    const day = formatDate(m.createdAt);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
    return groups;
  }, []);

  return (
    <div className="thread">
      <header className="thread__head">
        <Link to="?" className="icon-btn icon-btn--sm show-md" aria-label="Back to conversations">
          <ArrowLeft size={16} />
        </Link>
        <Avatar name={conversation.counterpart.name} src={conversation.counterpart.avatarUrl} />
        <div className="thread__who">
          <strong>{conversation.counterpart.name}</strong>
          <span className={isTyping ? 'thread__typing' : 'thread__role'}>{isTyping ? 'typing...' : conversation.role === 'buyer' ? 'Seller' : 'Interested buyer'}</span>
        </div>
        <button type="button" className="btn btn--sm btn--ghost thread__block" onClick={() => setBlockOpen(true)}>
          <UserX size={15} />
          <span className="hide-sm">{conversation.blockedByMe ? 'Unblock' : 'Block'}</span>
        </button>
      </header>

      <Link to={`/listings/${conversation.listingId}`} className="thread__ad">
        <ListingThumb conversation={conversation} />
        <span className="thread__ad-text">
          <strong>{conversation.listingTitle}</strong>
          <span className="tabular">{conversation.listingAvailable ? formatPrice(conversation.listingPrice) : 'No longer available'}</span>
        </span>
        <ExternalLink size={15} aria-hidden="true" />
      </Link>

      <div className="thread__messages" ref={listRef} aria-live="polite">
        <p className="thread__safety">
          <ShieldCheck size={15} aria-hidden="true" />
          Keep chats on Finovo Souq. Never pay in advance or share bank details, and meet in a public place.
        </p>
        {loading ? (
          <LoadingState label="Loading messages..." />
        ) : loadError ? (
          <ErrorState error={loadError} />
        ) : (
          <>
            {hasMore && (
              <button type="button" className="thread__older" onClick={() => void loadOlder()}>
                Load earlier messages
              </button>
            )}
            {days.length === 0 && <p className="thread__empty">Say hello and ask about the ad.</p>}
            {days.map((group) => (
              <div key={group.day} className="thread__day-group">
                <p className="thread__day">
                  <span>{group.day}</span>
                </p>
                {group.items.map((m) => (
                  <MessageBubble key={m.id} message={m} mine={m.senderId === user?.id} read={m.createdAt <= readUntil} onOpenImage={setViewer} onDelete={(msg) => void deleteMessage(msg)} />
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {blocked ? (
        <div className="thread__blocked">
          <ShieldAlert size={18} aria-hidden="true" />
          <span>{conversation.blockedByMe ? 'You blocked this person. They cannot message you here.' : 'You can no longer reply in this conversation.'}</span>
          {conversation.blockedByMe && (
            <Button size="sm" onClick={() => void toggleBlock()}>
              Unblock
            </Button>
          )}
        </div>
      ) : (
        <form className="composer" onSubmit={sendText}>
          {(error || recorder.error) && (
            <p className="field__error composer__error" role="alert">
              {error || recorder.error}
            </p>
          )}
          {recorder.recording ? (
            <div className="composer__recording" role="status">
              <button type="button" className="composer__icon" onClick={() => recorder.stop(false)} aria-label="Cancel recording">
                <Trash2 size={18} />
              </button>
              <span className="composer__rec-dot" aria-hidden="true" />
              <span className="composer__rec-time tabular">
                {clock(recorder.seconds)} / {clock(MAX_VOICE_SECONDS)}
              </span>
              <span className="composer__rec-label">Recording voice message</span>
              <button type="button" className="composer__send" onClick={() => recorder.stop(true)} aria-label="Send voice message">
                <Send size={18} />
              </button>
            </div>
          ) : (
            <div className="composer__row">
              <button type="button" className="composer__icon" onClick={() => photoInput.current?.click()} disabled={sending} aria-label="Send a photo">
                <ImagePlus size={20} />
              </button>
              <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={sendPhoto} />
              <label className="sr-only" htmlFor="message-input">
                Message
              </label>
              <textarea
                id="message-input"
                className="composer__input"
                rows={1}
                value={draft}
                maxLength={MAX_LENGTH}
                placeholder="Write a message..."
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendText();
                  }
                }}
              />
              {draft.trim() ? (
                <button type="submit" className="composer__send" disabled={sending} aria-label="Send message">
                  {sending ? <span className="btn__spinner" /> : <Send size={18} />}
                </button>
              ) : (
                <button type="button" className="composer__send composer__send--mic" onClick={() => void recorder.start()} disabled={sending} aria-label="Record a voice message">
                  {sending ? <span className="btn__spinner" /> : <Mic size={18} />}
                </button>
              )}
            </div>
          )}
        </form>
      )}

      <Modal open={Boolean(viewer)} title="Photo" onClose={() => setViewer(null)} maxWidth={900}>
        {viewer && <img className="photo-viewer" src={viewer} alt="Photo sent in this conversation" />}
      </Modal>

      <Modal
        open={blockOpen}
        title={conversation.blockedByMe ? `Unblock ${conversation.counterpart.name}?` : `Block ${conversation.counterpart.name}?`}
        description={conversation.blockedByMe ? 'You will both be able to send messages in this conversation again.' : 'Neither of you will be able to send messages in this conversation. You can unblock at any time.'}
        onClose={() => setBlockOpen(false)}
        footer={
          <>
            <Button onClick={() => setBlockOpen(false)}>Cancel</Button>
            <Button variant={conversation.blockedByMe ? 'primary' : 'danger'} onClick={() => void toggleBlock()}>
              {conversation.blockedByMe ? 'Unblock' : 'Block'}
            </Button>
          </>
        }
      >
        <p className="text-muted">Use “Report this ad” on the ad page if you think it is a scam.</p>
      </Modal>
    </div>
  );
}

export function MessagesPage() {
  useDocumentTitle('Messages');
  const [searchParams] = useSearchParams();
  const activeId = searchParams.get('c');
  const [query, setQuery] = useState('');
  const conversations = useAsync(() => conversationsService.list(), []);

  // Every chat event carries the inbox row as this user sees it
  const upsert = (conversation: Conversation) =>
    conversations.setData((list) => [conversation, ...(list ?? []).filter((c) => c.id !== conversation.id)].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)));
  useSocketEvent('message:new', ({ conversation }) => upsert(conversation));
  useSocketEvent('message:deleted', ({ conversation }) => upsert(conversation));
  useSocketEvent('conversation:read', ({ conversation }) => upsert(conversation));
  useSocketEvent('conversation:updated', ({ conversation }) => upsert(conversation));

  const active = conversations.data?.find((c) => c.id === activeId) ?? null;
  const q = query.trim().toLowerCase();
  const visible = (conversations.data ?? []).filter((c) => !q || c.counterpart.name.toLowerCase().includes(q) || c.listingTitle.toLowerCase().includes(q));

  return (
    <>
      <PageHeader title="Messages" subtitle="Private chats with buyers and sellers. Only the two of you can see them." />
      <div className={`messages card${active ? ' messages--open' : ''}`}>
        <aside className="messages__list" aria-label="Conversations">
          <label className="messages__search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search conversations</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or ad" />
          </label>
          {conversations.error ? (
            <ErrorState error={conversations.error} onRetry={conversations.reload} />
          ) : conversations.isLoading || !conversations.data ? (
            <div className="messages__skeleton">
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonBlock key={i} height={68} />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState icon={<MessageSquare size={26} />} title={q ? 'No matches' : 'No conversations yet'} text={q ? 'Try another name or ad title.' : 'When you message a seller, or a buyer messages you, the chat appears here.'} />
          ) : (
            <ul>
              {visible.map((c) => (
                <li key={c.id}>
                  <Link to={`?c=${c.id}`} className={`conversation${c.id === activeId ? ' is-active' : ''}${c.unreadCount ? ' is-unread' : ''}`} aria-current={c.id === activeId ? 'true' : undefined}>
                    <span className="conversation__media">
                      <ListingThumb conversation={c} />
                      <Avatar name={c.counterpart.name} src={c.counterpart.avatarUrl} size="sm" />
                    </span>
                    <span className="conversation__body">
                      <span className="conversation__row">
                        <strong>{c.counterpart.name}</strong>
                        <span className="conversation__time">{formatRelative(c.lastMessageAt)}</span>
                      </span>
                      <span className="conversation__ad">{c.listingTitle}</span>
                      <span className="conversation__row">
                        <span className="conversation__text">
                          {c.lastMessageMine && c.lastMessage && 'You: '}
                          {c.lastMessage || 'No messages yet'}
                        </span>
                        {c.unreadCount > 0 && <span className="count-pill">{c.unreadCount}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="messages__thread">
          {active ? (
            <Thread key={active.id} conversation={active} onConversation={upsert} />
          ) : (
            <EmptyState icon={<MessageSquare size={26} />} title="Select a conversation" text="Choose a chat to read and reply. Text, photos and voice messages are all private." />
          )}
        </section>
      </div>
    </>
  );
}
