import { useState } from 'react';
import { Check, CheckCheck, Trash2 } from 'lucide-react';
import type { Message } from '../../types';
import { formatTime } from '../../utils/format';
import { VoicePlayer } from './VoicePlayer';

interface MessageBubbleProps {
  message: Message;
  mine: boolean;
  read: boolean;
  onOpenImage: (url: string) => void;
  onDelete: (message: Message) => void;
}

export function MessageBubble({ message, mine, read, onOpenImage, onDelete }: MessageBubbleProps) {
  const [confirming, setConfirming] = useState(false);
  const { attachment } = message;

  return (
    <div className={`bubble bubble--${message.type}${mine ? ' bubble--mine' : ''}${message.deleted ? ' bubble--deleted' : ''}`} onMouseLeave={() => setConfirming(false)}>
      {message.deleted ? (
        <p className="bubble__deleted">This message was deleted</p>
      ) : (
        <>
          {message.type === 'image' && attachment && (
            <button type="button" className="bubble__image" onClick={() => onOpenImage(attachment.url)} aria-label="Open photo">
              <img src={attachment.url} alt="" width={attachment.width ?? undefined} height={attachment.height ?? undefined} loading="lazy" />
            </button>
          )}
          {message.type === 'voice' && attachment && <VoicePlayer src={attachment.url} duration={attachment.duration ?? 0} />}
          {message.body && <p className="bubble__text">{message.body}</p>}
        </>
      )}
      <span className="bubble__meta">
        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        {mine && !message.deleted && (read ? <CheckCheck size={14} className="bubble__tick bubble__tick--read" aria-label="Read" /> : <Check size={14} className="bubble__tick" aria-label="Sent" />)}
      </span>
      {mine && !message.deleted && (
        <button
          type="button"
          className={`bubble__delete${confirming ? ' is-confirming' : ''}`}
          onClick={() => (confirming ? onDelete(message) : setConfirming(true))}
          aria-label={confirming ? 'Confirm delete message' : 'Delete message'}
        >
          <Trash2 size={13} />
          {confirming && <span>Delete?</span>}
        </button>
      )}
    </div>
  );
}
