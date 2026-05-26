'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateEmail, validatePassword, validateLoginForm, isFormValid as checkFormValid } from '../lib/validators';
import { apiClient } from '../lib/api';
import { captureError } from '../lib/errorMonitoring';
import styles from './styles/login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setFieldErrors(prev => ({
      ...prev,
      email: validateEmail(value)
    }));
    setError('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setFieldErrors(prev => ({
      ...prev,
      password: validatePassword(value)
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const errors = validateLoginForm(email, password);
    setFieldErrors(errors);

    if (!checkFormValid(errors)) {
      return;
    }

    setLoading(true);

    try {
      // Use the centralized API client for login
      const response = await apiClient.login(email, password);
      
      // Store token in localStorage (TODO: use httpOnly cookie instead)
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      console.log('Login successful:', response.user.email);
      
      // Redirect to admin dashboard
      router.push('/adminDashBoard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(errorMessage);
      
      // Capture error for monitoring
      captureError(
        err instanceof Error ? err : new Error(errorMessage),
        { action: 'login', email }
      );
      
      setLoading(false);
    }
  };

  const isFormValid = checkFormValid(fieldErrors) && email && password;

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <div className={styles.logoContainer}>
          <img 
            src="/maneb.png" 
            alt="MANEB Logo" 
            className={styles.logo}
          />
        </div>
        
        <h1 className={styles.title}>Login</h1>
        
        {error && <div className={styles.error}>{error}</div>}
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={handleEmailChange}
              onBlur={() => setFieldErrors(prev => ({
                ...prev,
                email: validateEmail(email)
              }))}
              required
            />
            {fieldErrors.email && <span className={styles.fieldError}>{fieldErrors.email}</span>}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="password">Password</label>
            <input
              id="password"
              className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={handlePasswordChange}
              onBlur={() => setFieldErrors(prev => ({
                ...prev,
                password: validatePassword(password)
              }))}
              required
            />
            {fieldErrors.password && <span className={styles.fieldError}>{fieldErrors.password}</span>}
          </div>

          <button
            className={styles.button}
            type="submit"
            disabled={loading || !isFormValid}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
