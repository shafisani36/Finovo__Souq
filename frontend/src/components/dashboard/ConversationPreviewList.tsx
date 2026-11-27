import { Link } from 'react-router-dom';
import type { Conversation } from '../../types';
import { formatRelative } from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { t } from '../../i18n';

export function ConversationPreviewList({ conversations, basePath }: { conversations: Conversation[]; basePath: string }) {
  if (!conversations.length) return <p className="text-muted">{t('No conversations yet.')}</p>;
  return (
    <ul className="preview-list">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link to={`${basePath}?c=${c.id}`} className="preview-list__item">
            <Avatar name={c.counterpart.name} src={c.counterpart.avatarUrl} size="sm" />
            <div className="preview-list__body">
              <div className="preview-list__row">
                <strong>{c.counterpart.name}</strong>
                <span className="preview-list__time">{formatRelative(c.lastMessageAt)}</span>
              </div>
              <p className="preview-list__sub">{c.listingTitle}</p>
              <p className={`preview-list__text${c.unreadCount ? ' preview-list__text--unread' : ''}`}>{c.lastMessage || t('No messages yet')}</p>
            </div>
            {c.unreadCount > 0 && (
              <span className="count-pill" aria-label={t('{count} unread', { count: c.unreadCount })}>
                {c.unreadCount}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
