import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import styles from './RegisterPage.module.css';

interface FormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.email.trim()) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = 'Enter a valid email';
  if (!form.password) errors.password = 'Password is required';
  else if (form.password.length < 8)
    errors.password = 'Password must be at least 8 characters';
  if (!form.confirmPassword) errors.confirmPassword = 'Please confirm your password';
  else if (form.password !== form.confirmPassword)
    errors.confirmPassword = 'Passwords do not match';
  return errors;
}

export function RegisterPage() {
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState('');

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

    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setGlobalError('An account with this email already exists.');
      } else {
        setGlobalError('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>TL</div>
          <span className={styles.logoText}>TeamLens</span>
        </div>

        <h1 className={styles.title}>Create an account</h1>
        <p className={styles.subtitle}>Start managing your student projects</p>

        {globalError && <div className={styles.globalError}>{globalError}</div>}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              className={`${styles.input} ${fieldErrors.name ? styles.error : ''}`}
              placeholder="Dr. Jane Smith"
            />
            {fieldErrors.name && (
              <span className={styles.fieldError}>{fieldErrors.name}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className={`${styles.input} ${fieldErrors.email ? styles.error : ''}`}
              placeholder="you@university.edu"
            />
            {fieldErrors.email && (
              <span className={styles.fieldError}>{fieldErrors.email}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              className={`${styles.input} ${fieldErrors.password ? styles.error : ''}`}
              placeholder="Min. 8 characters"
            />
            {fieldErrors.password && (
              <span className={styles.fieldError}>{fieldErrors.password}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              className={`${styles.input} ${fieldErrors.confirmPassword ? styles.error : ''}`}
              placeholder="••••••••"
            />
            {fieldErrors.confirmPassword && (
              <span className={styles.fieldError}>{fieldErrors.confirmPassword}</span>
            )}
          </div>

          <button type="submit" className={styles.submitBtn} disabled={isLoading}>
            {isLoading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" className={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
