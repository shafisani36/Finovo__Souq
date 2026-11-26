import { useState, type FormEvent } from 'react';
import { ArrowRight, Clock, Mail, MailCheck, MapPin, MessageSquareText, Phone, Send, ShieldCheck, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError, getErrorMessage } from '../../api/errors';
import { PageHero } from '../../components/marketing/PageHero';
import { Button } from '../../components/ui/Button';
import { InputField, TextareaField } from '../../components/ui/Field';
import { useAuth } from '../../features/auth/context/useAuth';
import { EMAIL_PATTERN } from '../../features/auth/validation';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { settingsService } from '../../services/settings.service';
import { SUPPORT_TOPICS, supportService, type SupportMessagePayload } from '../../services/support.service';

type Errors = Partial<Record<'name' | 'email' | 'topic' | 'message' | 'form', string>>;

export function ContactPage() {
  const contact = useAsync(() => settingsService.get(), []).data?.contact;
  useDocumentTitle('Contact us');
  const { user } = useAuth();
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', topic: '', message: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Errors = {};
    if (form.name.trim().length < 2) next.name = 'Enter your name.';
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (!form.topic) next.topic = 'Choose a topic.';
    if (form.message.trim().length < 20) next.message = 'Write at least 20 characters so we can help.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSending(true);
    try {
      await supportService.send({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        topic: form.topic as SupportMessagePayload['topic'],
        message: form.message.trim(),
      });
      setSent(true);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors as Errors);
      else setErrors({ form: getErrorMessage(error) });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHero eyebrow="Contact" title="We are here to help" text="Questions about an ad, your account or something that does not look right? Send us a message." />

      <section className="section-lg">
        <div className="container">
          <div className="contact-shell" data-reveal>
            <aside className="contact-aside">
              <div>
                <p className="contact-aside__eyebrow">Contact information</p>
                <h2 className="contact-aside__title">Talk to the Finovo Souq team</h2>
                <p className="contact-aside__text">Questions about an ad, your account or something that does not look right? We read every message.</p>
              </div>
              <ul className="contact-aside__list">
                {contact?.email && (
                  <li>
                    <span className="contact-aside__icon">
                      <Mail size={18} />
                    </span>
                    <span>
                      <span className="contact-aside__label">Email</span>
                      <a href={`mailto:${contact.email}`}>{contact.email}</a>
                    </span>
                  </li>
                )}
                {contact?.phone && (
                  <li>
                    <span className="contact-aside__icon">
                      <Phone size={18} />
                    </span>
                    <span>
                      <span className="contact-aside__label">Phone</span>
                      <a href={`tel:${contact.phone.replace(/\s/g, '')}`} dir="ltr">
                        {contact.phone}
                      </a>
                    </span>
                  </li>
                )}
                {contact?.hours && (
                  <li>
                    <span className="contact-aside__icon">
                      <Clock size={18} />
                    </span>
                    <span>
                      <span className="contact-aside__label">Support hours</span>
                      {contact.hours}
                    </span>
                  </li>
                )}
                {contact?.city && (
                  <li>
                    <span className="contact-aside__icon">
                      <MapPin size={18} />
                    </span>
                    <span>
                      <span className="contact-aside__label">Office</span>
                      {contact.city}
                    </span>
                  </li>
                )}
              </ul>
              <div className="contact-aside__faq">
                <p>Most questions are already answered in the FAQ.</p>
                <Link to="/faq">
                  Read the FAQ <ArrowRight size={15} />
                </Link>
              </div>
            </aside>

            <div className="contact-main">
              {sent ? (
                <div className="contact-sent">
                  <span className="contact-sent__icon">
                    <MailCheck size={28} />
                  </span>
                  <h2>Message sent</h2>
                  <p>Thank you, {form.name.split(' ')[0]}. Our team replies to {form.email} within one working day.</p>
                  <Button
                    onClick={() => {
                      setSent(false);
                      setForm((f) => ({ ...f, topic: '', message: '' }));
                    }}
                  >
                    Send another message
                  </Button>
                </div>
              ) : (
                <form className="contact-form" onSubmit={submit} noValidate>
                  <div className="contact-form__head">
                    <h2>Send us a message</h2>
                    <p>Fill in the form and we will get back to you by email.</p>
                  </div>
                  {errors.form && (
                    <div className="alert alert--danger" role="alert">
                      {errors.form}
                    </div>
                  )}
                  <div className="form-grid">
                    <InputField label="Your name" autoComplete="name" icon={<User size={17} />} placeholder="Full name" value={form.name} onChange={(e) => set('name')(e.target.value)} error={errors.name} required maxLength={60} />
                    <InputField label="Email address" type="email" autoComplete="email" icon={<Mail size={17} />} placeholder="you@example.com" value={form.email} onChange={(e) => set('email')(e.target.value)} error={errors.email} required />
                  </div>

                  <fieldset className="topic-picker">
                    <legend className="field__label">
                      What is it about? <span className="field__required" aria-hidden="true">*</span>
                    </legend>
                    <div className="topic-picker__options" role="radiogroup" aria-invalid={Boolean(errors.topic)}>
                      {SUPPORT_TOPICS.map((topic) => (
                        <label key={topic} className={`topic-option${form.topic === topic ? ' is-checked' : ''}`}>
                          <input type="radio" name="topic" value={topic} checked={form.topic === topic} onChange={() => set('topic')(topic)} />
                          {topic}
                        </label>
                      ))}
                    </div>
                    {errors.topic && <span className="field__error">{errors.topic}</span>}
                  </fieldset>

                  <div className="contact-form__message">
                    <TextareaField
                      label="Message"
                      rows={6}
                      placeholder="Tell us what happened, with the ad link or title if it is about an ad."
                      value={form.message}
                      onChange={(e) => set('message')(e.target.value)}
                      error={errors.message}
                      required
                      maxLength={2000}
                    />
                    <span className="contact-form__count tabular" aria-live="polite">
                      <MessageSquareText size={13} /> {form.message.length}/2000
                    </span>
                  </div>

                  <div className="contact-form__foot">
                    <p>
                      <ShieldCheck size={15} /> We only use your details to answer this message.
                    </p>
                    <Button type="submit" variant="primary" size="lg" isLoading={sending} icon={<Send size={17} />}>
                      Send message
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
