import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { getErrorMessage } from '../../api/errors';
import { Button } from './Button';

export { LoadingState, SkeletonBlock } from './LoadingState';

interface EmptyStateProps {
  title: string;
  text?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, text, icon, action }: EmptyStateProps) {
  return (
    <div className="state">
      <div className="state__icon">{icon ?? <Inbox size={26} />}</div>
      <h3 className="state__title">{title}</h3>
      {text && <p className="state__text">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'We could not load this' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="state" role="alert">
      <div className="state__icon state__icon--danger">
        <AlertTriangle size={26} />
      </div>
      <h3 className="state__title">{title}</h3>
      <p className="state__text">{getErrorMessage(error)}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}
