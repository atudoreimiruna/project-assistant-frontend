import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import styles from '../LoginPage/LoginPage.module.css';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGlobalError('');
    setSuccessMsg('');

    if (!email.trim()) {
      setFieldError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('Enter a valid email');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setSuccessMsg('If an account exists for that email, a reset link has been sent.');
    } catch (err) {
      if (err instanceof ApiError) {
        setGlobalError(err.message || 'Something went wrong. Please try again.');
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

        <h1 className={styles.title}>Reset your password</h1>
        <p className={styles.subtitle}>
          Enter your email and we'll send you a reset link.
        </p>

        {globalError && <div className={styles.globalError}>{globalError}</div>}
        {successMsg && <div className={styles.successMsg}>{successMsg}</div>}

        {!successMsg && (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldError('');
                }}
                className={`${styles.input} ${fieldError ? styles.error : ''}`}
                placeholder="you@university.edu"
              />
              {fieldError && <span className={styles.fieldError}>{fieldError}</span>}
            </div>

            <button type="submit" className={styles.submitBtn} disabled={isLoading}>
              {isLoading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className={styles.footer}>
          <Link to="/login" className={styles.link}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
