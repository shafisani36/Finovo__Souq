import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getErrorMessage } from '../../../api/errors';
import { EMAIL_PATTERN } from '../validation';
import { Button } from '../../../components/ui/Button';
import { InputField } from '../../../components/ui/Field';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { AuthLayout } from '../../../layouts/AuthLayout';
import { useAuth } from '../context/useAuth';
import { safeRedirectFor } from '../rbac';
import { t } from '../../../i18n';

export function LoginPage() {
  useDocumentTitle(t('Sign in'));
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = t('Enter your email address.');
    else if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = t('Enter a valid email address.');
    if (!password) nextErrors.password = t('Enter your password.');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const user = await login(email.trim().toLowerCase(), password);
      navigate(safeRedirectFor(user.role, searchParams.get('redirect')), { replace: true });
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors({ email: error.fieldErrors.email, password: error.fieldErrors.password });
        return;
      }
      setErrors({ form: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title={t('Welcome back')} subtitle={t('Sign in to manage your ads, messages and saved items.')}>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {errors.form && (
          <div className="alert alert--danger" role="alert">
            {errors.form}
          </div>
        )}
        <InputField
          label={t('Email address')}
          name="email"
          type="email"
          autoComplete="email"
          icon={<Mail size={17} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('you@example.com')}
          error={errors.email}
          required
        />
        <InputField
          label={t('Password')}
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          icon={<Lock size={17} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
          suffix={
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? t('Hide password') : t('Show password')}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />
        <div className="auth-form__row">
          <Link to="/forgot-password" className="link">
            {t('Forgot password?')}
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" block isLoading={submitting} icon={<LogIn size={18} />}>
          {t('Sign in')}
        </Button>
      </form>
    </AuthLayout>
  );
}
