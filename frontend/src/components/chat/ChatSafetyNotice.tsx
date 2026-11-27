import { Link } from 'react-router-dom';
import { MapPin, ShieldAlert } from 'lucide-react';
import type { MessageRisk } from '../../types';
import { t } from '../../i18n';

const WARNINGS: Record<Exclude<MessageRisk, 'meeting'>, string> = {
  payment: t('Never pay a deposit or transfer money before you see the item in person.'),
  link: t('Be careful with links. Finovo Souq never asks you to pay or sign in through a link in chat.'),
  off_platform: t('Keep the chat on Finovo Souq. If something goes wrong, we can only help with messages sent here.'),
  code: t('Never share a verification code. No real buyer or seller needs it.'),
};

interface ChatSafetyNoticeProps {
  risks: MessageRisk[];
  mine: boolean;
}

/**
 * Shown under a message with scam signs. The warning is for the person who received it;
 * the meet-up tip is shown to both sides.
 */
export function ChatSafetyNotice({ risks, mine }: ChatSafetyNoticeProps) {
  const warnings = mine ? [] : risks.filter((r): r is Exclude<MessageRisk, 'meeting'> => r !== 'meeting');
  const meeting = risks.includes('meeting');
  if (!warnings.length && !meeting) return null;

  return (
    <div className={`chat-safety${mine ? ' chat-safety--mine' : ''}`}>
      {warnings.length > 0 && (
        <div className="chat-safety__item chat-safety__item--warning" role="note">
          <ShieldAlert size={15} aria-hidden="true" />
          <span>
            <strong>{t('Safety check')}</strong>
            {warnings.map((w) => (
              <span key={w}>{WARNINGS[w]}</span>
            ))}
          </span>
        </div>
      )}
      {meeting && (
        <div className="chat-safety__item" role="note">
          <MapPin size={15} aria-hidden="true" />
          <span>
            <strong>{t('Meeting up?')}</strong>
            <span>{t('Choose a busy public place in daylight, bring someone with you, and check the item before you pay.')}</span>
            <Link to="/safety#meet">{t('Safe places to meet')}</Link>
          </span>
        </div>
      )}
    </div>
  );
}
