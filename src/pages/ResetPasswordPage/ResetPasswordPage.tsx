import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import styles from '../LoginPage/LoginPage.module.css';

interface FormState {
  password: string;
  confirm: string;
}

interface FieldErrors {
  password?: string;
  confirm?: string;
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.password) errors.password = 'Password is required';
  else if (form.password.length < 8) errors.password = 'Password must be at least 8 characters';
  if (!form.confirm) errors.confirm = 'Please confirm your password';
  else if (form.password !== form.confirm) errors.confirm = 'Passwords do not match';
  return errors;
}

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({ password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGlobalError('');

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (!token) {
      setGlobalError('Invalid or missing reset token.');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword(token, { password: form.password });
      navigate('/login', { state: { message: 'Password reset successful. You can now sign in.' } });
    } catch (err) {
      if (err instanceof ApiError) {
        setGlobalError(err.message || 'Reset link is invalid or has expired.');
      } else {
        setGlobalError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>TL</div>
          <span className={styles.logoText}>TeamLens</span>
        </div>

        <h1 className={styles.title}>Choose a new password</h1>
        <p className={styles.subtitle}>Must be at least 8 characters.</p>

        {globalError && <div className={styles.globalError}>{globalError}</div>}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              className={`${styles.input} ${fieldErrors.password ? styles.error : ''}`}
              placeholder="••••••••"
            />
            {fieldErrors.password && (
              <span className={styles.fieldError}>{fieldErrors.password}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirm">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={handleChange}
              className={`${styles.input} ${fieldErrors.confirm ? styles.error : ''}`}
              placeholder="••••••••"
            />
            {fieldErrors.confirm && (
              <span className={styles.fieldError}>{fieldErrors.confirm}</span>
            )}
          </div>

          <button type="submit" className={styles.submitBtn} disabled={isLoading}>
            {isLoading ? 'Resetting…' : 'Reset password'}
          </button>
        </form>

        <p className={styles.footer}>
          <Link to="/login" className={styles.link}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
