import { ArrowRight, PlusCircle } from 'lucide-react';
import { useAuth } from '../../features/auth/context/useAuth';
import { canSell } from '../../features/auth/rbac';
import { ButtonLink } from '../ui/Button';
import { t } from '../../i18n';

/** Closing call to action shared by the landing and information pages */
export function CtaBand() {
  const { user } = useAuth();
  const postLink = !user ? '/register' : user.role === 'admin' ? '/admin/dashboard' : canSell(user) ? '/account/listings/new' : null;
  return (
    <section className="section-lg">
      <div className="container">
        <div className="cta-band" data-reveal>
          <div>
            <h2 className="cta-band__title">{t('Have something to sell?')}</h2>
            <p className="cta-band__text">{t('Post it free in a few minutes. Our team checks it and it goes live for buyers across Saudi Arabia.')}</p>
          </div>
          <div className="cta-band__actions">
            {postLink && (
              <ButtonLink to={postLink} className="btn--light" icon={<PlusCircle size={17} />}>
                {user?.role === 'admin' ? t('Open dashboard') : t('Post an ad')}
              </ButtonLink>
            )}
            <ButtonLink to="/search" className="btn--outline-light" icon={<ArrowRight size={17} />}>
              {t('Browse ads')}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
