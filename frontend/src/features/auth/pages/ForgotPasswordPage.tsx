import { useState, type FormEvent } from 'react';
import { MailCheck, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../../api/errors';
import { Button } from '../../../components/ui/Button';
import { InputField } from '../../../components/ui/Field';
import { EmptyState } from '../../../components/ui/States';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { AuthLayout } from '../../../layouts/AuthLayout';
import { authService } from '../../../services/auth.service';
import { EMAIL_PATTERN } from '../validation';

export function ForgotPasswordPage() {
  useDocumentTitle('Reset password');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout showTabs={false} title="Reset your password" subtitle="Enter the email address on your account.">
      {sent ? (
        <EmptyState
          icon={<MailCheck size={26} />}
          title="Check your inbox"
          text="If an account exists for these details, you will receive instructions to reset your password shortly."
          action={<Link to="/login" className="btn">Back to sign in</Link>}
        />
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <InputField
            label="Email address"
            type="email"
            autoComplete="email"
            icon={<Mail size={17} />}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            error={error}
            required
          />
          <Button type="submit" variant="primary" size="lg" block isLoading={submitting}>
            Send reset instructions
          </Button>
          <p className="auth-form__switch">
            Remembered it? <Link to="/login" className="link">Sign in</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
