import { useEffect, useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, KeyRound, Lock, Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, getErrorMessage } from '../../../api/errors';
import { Button } from '../../../components/ui/Button';
import { InputField } from '../../../components/ui/Field';
import { useToast } from '../../../components/ui/toast-context';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { AuthLayout } from '../../../layouts/AuthLayout';
import { authService } from '../../../services/auth.service';
import { EMAIL_PATTERN, PASSWORD_RULES, passwordTooLong } from '../validation';
import { t } from '../../../i18n';

const RESEND_SECONDS = 60;

type FormErrors = Partial<Record<'email' | 'otp' | 'password' | 'confirm' | 'form', string>>;

export function ForgotPasswordPage() {
  useDocumentTitle(t('Reset password'));
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [form, setForm] = useState({ email: '', otp: '', password: '', confirm: '' });
  const [resetToken, setResetToken] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (!resendIn) return undefined;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  const showError = (error: unknown) => {
    if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors);
    else setErrors({ form: getErrorMessage(error) });
  };

  const sendCode = async () => {
    const email = form.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      setErrors({ email: 'Enter a valid email address.' });
      return;
    }
    setSubmitting(true);
    try {
      await authService.forgotPassword(email);
      setStep('code');
      setForm((f) => ({ ...f, otp: '' }));
      setResendIn(RESEND_SECONDS);
      setErrors({});
    } catch (error) {
      showError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(form.otp)) {
      setErrors({ otp: 'Enter the 6-digit code from the email.' });
      return;
    }
    setSubmitting(true);
    try {
      setResetToken(await authService.verifyResetCode(form.email.trim().toLowerCase(), form.otp));
      setStep('password');
      setErrors({});
    } catch (error) {
      showError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    const next: FormErrors = {};
    if (PASSWORD_RULES.some((rule) => !rule.test(form.password))) next.password = t('Your password does not meet all the rules below.');
    else if (passwordTooLong(form.password)) next.password = t('Password is too long.');
    if (form.confirm !== form.password) next.confirm = t('Passwords do not match.');
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await authService.resetPassword({ email: form.email.trim().toLowerCase(), resetToken, password: form.password });
      toast.show({ title: t('Password changed'), message: t('Sign in with your new password.') });
      navigate('/login', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && !Object.keys(error.fieldErrors).length) {
        // The reset session expired, so the visitor has to start again
        setStep('email');
        setResetToken('');
      }
      showError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const current = {
    email: { subtitle: t('Enter the email address on your account and we will send you a 6-digit code.'), button: 'Send code', submit: sendCode },
    code: {
      subtitle: t('If an account exists for {value}, we sent a 6-digit code to it. It expires in 10 minutes.', {
        value: form.email.trim(),
      }),
      button: 'Verify code',
      submit: verifyCode,
    },
    password: { subtitle: t('Code verified. Choose a new password for your account.'), button: 'Change password', submit: resetPassword },
  }[step];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void current.submit();
  };

  return (
    <AuthLayout showTabs={false} title={t('Reset your password')} subtitle={current.subtitle}>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {errors.form && (
          <div className="alert alert--danger" role="alert">
            {errors.form}
          </div>
        )}

        {step === 'email' && (
          <InputField
            label={t('Email address')}
            type="email"
            autoComplete="email"
            icon={<Mail size={17} />}
            placeholder={t('you@example.com')}
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
            error={errors.email}
            required
          />
        )}

        {step === 'code' && (
          <InputField
            label={t('Code from the email')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            icon={<KeyRound size={17} />}
            placeholder={t('6-digit code')}
            value={form.otp}
            onChange={(e) => set('otp')(e.target.value.replace(/\D/g, ''))}
            error={errors.otp}
            required
            autoFocus
          />
        )}

        {step === 'password' && (
          <>
            <div className="form-grid">
              <InputField
                label={t('New password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                icon={<Lock size={17} />}
                value={form.password}
                onChange={(e) => set('password')(e.target.value)}
                error={errors.password}
                required
                suffix={
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? t('Hide password') : t('Show password')}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
              <InputField
                label={t('Confirm password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                icon={<Lock size={17} />}
                value={form.confirm}
                onChange={(e) => set('confirm')(e.target.value)}
                error={errors.confirm}
                required
              />
            </div>
            <ul className="password-rules" aria-label={t('Password rules')}>
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(form.password);
                return (
                  <li key={rule.label} className={met ? 'is-met' : undefined}>
                    <Check size={13} strokeWidth={3} aria-hidden="true" />
                    {rule.label}
                    <span className="sr-only">{met ? t(' (done)') : t(' (missing)')}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <Button type="submit" variant="primary" size="lg" block isLoading={submitting}>
          {current.button}
        </Button>

        {step === 'code' && (
          <p className="auth-form__switch">
            <button type="button" className="link link--button" onClick={() => void sendCode()} disabled={submitting || resendIn > 0}>
              {resendIn > 0
                ? t('Send a new code in {resendIn}s', {
                    resendIn,
                  })
                : t('Send a new code')}
            </button>
          </p>
        )}
        {step === 'email' && (
          <p className="auth-form__switch">
            {t('Remembered it?')}{' '}
            <Link to="/login" className="link">
              {t('Sign in')}
            </Link>
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
