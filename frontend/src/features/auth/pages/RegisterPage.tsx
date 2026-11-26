import { useState, type FormEvent } from 'react';
import { Check, Clock, Eye, EyeOff, Lock, Mail, Phone, ShoppingBag, Store, User as UserIcon } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getErrorMessage } from '../../../api/errors';
import { Button } from '../../../components/ui/Button';
import { InputField } from '../../../components/ui/Field';
import { EmptyState } from '../../../components/ui/States';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { AuthLayout } from '../../../layouts/AuthLayout';
import { useAuth } from '../context/useAuth';
import { safeRedirectFor } from '../rbac';
import type { AccountType } from '../../../types';
import { EMAIL_PATTERN, PASSWORD_RULES, passwordTooLong } from '../validation';

type FormErrors = Partial<Record<'name' | 'phone' | 'email' | 'password' | 'confirm' | 'terms' | 'form', string>>;

/** Accepts 05XXXXXXXX, 5XXXXXXXX or +9665XXXXXXXX and returns +9665XXXXXXXX */
function normalizeSaudiPhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  const match = digits.match(/^(?:\+?966|0)?(5\d{8})$/);
  return match ? `+966${match[1]}` : null;
}

export function RegisterPage() {
  useDocumentTitle('Create account');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [accountType, setAccountType] = useState<AccountType>('buyer');
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const name = form.name.trim();
    if (name.length < 2) next.name = 'Enter your full name.';
    else if (name.length > 60) next.name = 'Name cannot be longer than 60 characters.';
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (form.phone.trim() && !normalizeSaudiPhone(form.phone)) next.phone = 'Enter a Saudi mobile number, e.g. 05XXXXXXXX.';
    if (PASSWORD_RULES.some((rule) => !rule.test(form.password))) next.password = 'Your password does not meet all the rules below.';
    else if (passwordTooLong(form.password)) next.password = 'Password is too long.';
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.';
    if (!acceptTerms) next.terms = 'Please accept the terms to continue.';
    return next;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const phone = normalizeSaudiPhone(form.phone);
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        accountType,
        ...(phone ? { phone } : {}),
      });
      if (!user) {
        setAwaitingApproval(true);
        return;
      }
      navigate(safeRedirectFor(user.role, searchParams.get('redirect')), { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CONFLICT') {
        setErrors({ email: error.message.endsWith('.') ? error.message : `${error.message}.` });
      } else if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors(error.fieldErrors as FormErrors);
      } else {
        setErrors({ form: getErrorMessage(error) });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (awaitingApproval) {
    return (
      <AuthLayout showTabs={false} title="Thanks for signing up" subtitle="Your seller account has been created.">
        <EmptyState
          icon={<Clock size={26} />}
          title="Waiting for admin approval"
          text={`Our team checks every seller account. We will email ${form.email.trim()} as soon as it is approved, and then you can sign in and post ads.`}
          action={<Link to="/" className="btn">Back to home</Link>}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Buy with a free account, or sign up as a seller to post ads.">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="segmented segmented--block" role="radiogroup" aria-label="Account type">
          {([
            { value: 'buyer', label: 'I want to buy', icon: ShoppingBag },
            { value: 'seller', label: 'I want to sell', icon: Store },
          ] as const).map((option) => (
            <button key={option.value} type="button" role="radio" aria-checked={accountType === option.value} className="segmented__item" onClick={() => setAccountType(option.value)}>
              <option.icon size={16} />
              {option.label}
            </button>
          ))}
        </div>
        {accountType === 'seller' && <p className="auth-form__note">Seller accounts are checked by our team. You can sign in once yours is approved.</p>}
        {errors.form && (
          <div className="alert alert--danger" role="alert">
            {errors.form}
          </div>
        )}
        <InputField label="Full name" autoComplete="name" icon={<UserIcon size={17} />} value={form.name} onChange={(e) => set('name')(e.target.value)} error={errors.name} required maxLength={60} />
        <div className="form-grid">
          <InputField label="Email address" type="email" autoComplete="email" icon={<Mail size={17} />} placeholder="you@example.com" value={form.email} onChange={(e) => set('email')(e.target.value)} error={errors.email} required />
          <InputField label="Mobile (optional)" type="tel" inputMode="tel" autoComplete="tel" icon={<Phone size={17} />} placeholder="05XXXXXXXX" value={form.phone} onChange={(e) => set('phone')(e.target.value)} error={errors.phone} />
        </div>
        <div className="form-grid">
          <InputField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            icon={<Lock size={17} />}
            value={form.password}
            onChange={(e) => set('password')(e.target.value)}
            error={errors.password}
            required
            suffix={
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          <InputField label="Confirm password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" icon={<Lock size={17} />} value={form.confirm} onChange={(e) => set('confirm')(e.target.value)} error={errors.confirm} required />
        </div>
        <ul className="password-rules" aria-label="Password rules">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(form.password);
            return (
              <li key={rule.label} className={met ? 'is-met' : undefined}>
                <Check size={13} strokeWidth={3} aria-hidden="true" />
                {rule.label}
                <span className="sr-only">{met ? ' (done)' : ' (missing)'}</span>
              </li>
            );
          })}
        </ul>
        <div className="field">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                setErrors((x) => ({ ...x, terms: undefined }));
              }}
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" className="link" target="_blank" rel="noopener">
                terms of use
              </Link>{' '}
              and the{' '}
              <Link to="/privacy" className="link" target="_blank" rel="noopener">
                privacy policy
              </Link>
              .
            </span>
          </label>
          {errors.terms && <span className="field__error">{errors.terms}</span>}
        </div>
        <Button type="submit" variant="primary" size="lg" block isLoading={submitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
