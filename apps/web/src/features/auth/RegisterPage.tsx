import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { WarningCircle, Eye, EyeClosed, Flask } from 'iconoir-react';
import type { components } from '@valid-ex/contracts';

type RegisterFormValues = components['schemas']['RegisterRequest'];
type RegisterField = keyof RegisterFormValues;
type RegisterErrors = Partial<Record<RegisterField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateField(field: RegisterField, values: RegisterFormValues): string | undefined {
  const value = values[field];

  if (field === 'name') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Full name is required.';
    }
    if (trimmed.length < 2) {
      return 'Full name must be at least 2 characters.';
    }
    return undefined;
  }

  if (field === 'email') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Email is required.';
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      return 'Enter a valid email address, such as analyst@lab.org.';
    }
    return undefined;
  }

  if (!value) {
    return 'Password is required.';
  }
  if (value.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return undefined;
}

function validateAll(values: RegisterFormValues): RegisterErrors {
  const errors: RegisterErrors = {};
  const fields: RegisterField[] = ['name', 'email', 'password'];

  for (const field of fields) {
    const message = validateField(field, values);
    if (message) {
      errors[field] = message;
    }
  }

  return errors;
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [values, setValues] = useState<RegisterFormValues>({
    name: '',
    email: '',
    password: '',
  });
  const [dirty, setDirty] = useState<Record<RegisterField, boolean>>({
    name: false,
    email: false,
    password: false,
  });
  const [blurred, setBlurred] = useState<Record<RegisterField, boolean>>({
    name: false,
    email: false,
    password: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [fieldAnnouncement, setFieldAnnouncement] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const redirectTimerRef = useRef<number | null>(null);
  const announceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    document.title = 'Create Account | Valid-Ex';
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
      if (announceTimerRef.current !== null) {
        window.clearTimeout(announceTimerRef.current);
      }
    };
  }, []);

  const errors = validateAll(values);

  const shouldShowError = (field: RegisterField) =>
    Boolean(errors[field] && (submitted || (dirty[field] && blurred[field])));

  const handleChange = (field: RegisterField, nextValue: string) => {
    const nextValues = { ...values, [field]: nextValue };
    setValues(nextValues);
    setDirty((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
    if (statusMessage) {
      setStatusMessage(null);
    }
    if (!validateField(field, nextValues)) {
      if (announceTimerRef.current !== null) {
        window.clearTimeout(announceTimerRef.current);
      }
      setFieldAnnouncement('');
    }
  };

  const handleBlur = (field: RegisterField) => {
    setBlurred((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
    if (dirty[field]) {
      const errorMsg = validateField(field, values);
      if (errorMsg) {
        if (announceTimerRef.current !== null) {
          window.clearTimeout(announceTimerRef.current);
        }
        setFieldAnnouncement('');
        announceTimerRef.current = window.setTimeout(() => {
          setFieldAnnouncement(errorMsg);
        }, 500);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitted(true);

    if (errors.name) {
      nameRef.current?.focus();
      return;
    }
    if (errors.email) {
      emailRef.current?.focus();
      return;
    }
    if (errors.password) {
      passwordRef.current?.focus();
      return;
    }

    // TODO: Connect to POST /api/v1/auth/register once the API gateway is ready
    setIsSubmitting(true);
    setStatusMessage(
      `Account details for ${values.name.trim()} are valid (local preview mode). Opening workspace...`,
    );
    redirectTimerRef.current = window.setTimeout(() => {
      navigate('/calibrations');
    }, 300);
  };

  const nameErrorVisible = shouldShowError('name');
  const emailErrorVisible = shouldShowError('email');
  const passwordErrorVisible = shouldShowError('password');

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6">
        <header className="space-y-2 text-center">
          <div
            aria-hidden="true"
            className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center mx-auto shadow-xs"
          >
            <Flask className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Create a Valid-Ex Account</h1>
          <p className="text-sm text-slate-600">
            Create an analyst account to manage ISO/IEC 17025 calibrations and quality control.
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="register-name" className="block text-sm font-medium text-slate-700">
              Full Name{' '}
              <span className="text-red-700" aria-hidden="true">
                *
              </span>
            </label>
            <p id="register-name-hint" className="text-xs text-slate-600">
              At least 2 characters; shown on report audit trails.
            </p>
            <input
              ref={nameRef}
              id="register-name"
              name="name"
              type="text"
              autoComplete="name"
              enterKeyHint="next"
              minLength={2}
              required
              placeholder="Your full name"
              value={values.name}
              onChange={(e) => handleChange('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              aria-invalid={nameErrorVisible ? 'true' : 'false'}
              aria-describedby={
                nameErrorVisible ? 'register-name-hint register-name-error' : 'register-name-hint'
              }
              className={`w-full min-h-11 px-3 py-2 rounded-lg border text-base text-slate-900 placeholder:text-slate-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                nameErrorVisible ? 'border-red-700 bg-red-50/40' : 'border-slate-500 bg-white'
              }`}
            />
            {nameErrorVisible && (
              <p
                id="register-name-error"
                className="flex items-start gap-1.5 text-xs font-medium text-red-700 pt-0.5"
              >
                <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errors.name}</span>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="register-email" className="block text-sm font-medium text-slate-700">
              Analyst Email{' '}
              <span className="text-red-700" aria-hidden="true">
                *
              </span>
            </label>
            <p id="register-email-hint" className="text-xs text-slate-600">
              Format: name@organization.org.
            </p>
            <input
              ref={emailRef}
              id="register-email"
              name="email"
              type="email"
              autoComplete="username"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="none"
              enterKeyHint="next"
              required
              placeholder="email@organization.org"
              value={values.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              aria-invalid={emailErrorVisible ? 'true' : 'false'}
              aria-describedby={
                emailErrorVisible
                  ? 'register-email-hint register-email-error'
                  : 'register-email-hint'
              }
              className={`w-full min-h-11 px-3 py-2 rounded-lg border text-base text-slate-900 placeholder:text-slate-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                emailErrorVisible ? 'border-red-700 bg-red-50/40' : 'border-slate-500 bg-white'
              }`}
            />
            {emailErrorVisible && (
              <p
                id="register-email-error"
                className="flex items-start gap-1.5 text-xs font-medium text-red-700 pt-0.5"
              >
                <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errors.email}</span>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="register-password" className="block text-sm font-medium text-slate-700">
              Password{' '}
              <span className="text-red-700" aria-hidden="true">
                *
              </span>
            </label>
            <p id="register-password-hint" className="text-xs text-slate-600">
              At least 8 characters. Pasting from a password manager is supported.
            </p>
            <div className="relative flex items-center">
              <input
                ref={passwordRef}
                id="register-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                enterKeyHint="done"
                minLength={8}
                required
                placeholder="At least 8 characters"
                value={values.password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
                aria-invalid={passwordErrorVisible ? 'true' : 'false'}
                aria-describedby={
                  passwordErrorVisible
                    ? 'register-password-hint register-password-error'
                    : 'register-password-hint'
                }
                className={`w-full min-h-11 pl-3 pr-12 py-2 rounded-lg border text-base text-slate-900 placeholder:text-slate-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                  passwordErrorVisible ? 'border-red-700 bg-red-50/40' : 'border-slate-500 bg-white'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-describedby="register-password-toggle-note"
                className="absolute right-0.5 min-w-11 min-h-11 flex items-center justify-center rounded-md text-slate-700 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                {showPassword ? (
                  <EyeClosed className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <span id="register-password-toggle-note" className="sr-only">
              Note: this button reveals password characters on screen.
            </span>
            {passwordErrorVisible && (
              <p
                id="register-password-error"
                className="flex items-start gap-1.5 text-xs font-medium text-red-700 pt-0.5"
              >
                <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errors.password}</span>
              </p>
            )}
          </div>

          <div aria-live="polite" className={statusMessage ? undefined : 'sr-only'}>
            {statusMessage ? (
              <p className="rounded-lg border border-emerald-700 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                {statusMessage}
              </p>
            ) : (
              fieldAnnouncement
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-11 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {isSubmitting ? 'Preparing Workspace...' : 'Create Analyst Account'}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-200 space-y-2 text-center">
          <p className="text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="inline-flex items-center min-h-11 px-1 font-semibold text-slate-900 underline underline-offset-4 hover:text-slate-700 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Sign in
            </Link>
          </p>
          <p className="text-xs text-slate-600 font-mono">
            UI Preview Mode (Not connected to auth API)
          </p>
        </div>
      </div>
    </main>
  );
}
