import { Compass } from 'lucide-react';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/States';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { t } from '../../i18n';

export function NotFoundPage() {
  useDocumentTitle(t('Page not found'));
  return (
    <div className="container section">
      <div className="card">
        <EmptyState
          icon={<Compass size={26} />}
          title={t('We could not find that page')}
          text={t('The link may be broken or the page may have moved.')}
          action={
            <ButtonLink to="/" variant="primary">
              {t('Go to home page')}
            </ButtonLink>
          }
        />
      </div>
    </div>
  );
}
