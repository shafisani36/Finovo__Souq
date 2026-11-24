import { ArrowRight, PlusCircle } from 'lucide-react';
import { useAuth } from '../../features/auth/context/useAuth';
import { ButtonLink } from '../ui/Button';

/** Closing call to action shared by the landing and information pages */
export function CtaBand() {
  const { user } = useAuth();
  const postLink = user ? (user.role === 'user' ? '/account/listings/new' : '/admin/dashboard') : '/register';
  return (
    <section className="section-lg">
      <div className="container">
        <div className="cta-band" data-reveal>
          <div>
            <h2 className="cta-band__title">Have something to sell?</h2>
            <p className="cta-band__text">Post it free in a few minutes. Our team checks it and it goes live for buyers across Saudi Arabia.</p>
          </div>
          <div className="cta-band__actions">
            <ButtonLink to={postLink} className="btn--light" icon={<PlusCircle size={17} />}>
              {user?.role === 'admin' ? 'Open dashboard' : 'Post an ad'}
            </ButtonLink>
            <ButtonLink to="/search" className="btn--outline-light" icon={<ArrowRight size={17} />}>
              Browse ads
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
