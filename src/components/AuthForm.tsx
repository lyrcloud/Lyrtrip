'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  confirmResetPassword,
  confirmSignUp,
  resendConfirmationCode,
  resetPassword,
  signIn,
  signInWithFacebook,
  signInWithGoogle,
  signInWithWeChat,
  signUp,
} from '@/lib/auth';
import { SocialButton } from '@/components/SocialButton';
import { useLocale } from '@/i18n/LocaleContext';

interface AuthFormProps {
  mode?: 'signin' | 'signup';
}

type Step = 'form' | 'confirm' | 'reset';

const RESEND_COOLDOWN_SECONDS = 60;

function errorName(err: unknown) {
  return (err as { name?: string } | null)?.name;
}

export function AuthForm({ mode = 'signin' }: AuthFormProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [activeMode, setActiveMode] = useState<'signin' | 'signup'>(mode);
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn(seconds => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const switchMode = (next: 'signin' | 'signup') => {
    setActiveMode(next);
    setStep('form');
    setError(null);
    setInfo(null);
    setPassword('');
  };

  const openStep = (next: 'confirm' | 'reset', message: string) => {
    setCode('');
    setNewPassword('');
    setStep(next);
    setInfo(message);
    setResendIn(RESEND_COOLDOWN_SECONDS);
  };

  const cancelStep = () => {
    setStep('form');
    setCode('');
    setNewPassword('');
    setError(null);
    setInfo(null);
  };

  const handleSocial = async (provider: 'google' | 'facebook' | 'wechat') => {
    setError(null);
    setSocialLoading(provider);
    try {
      if (provider === 'google') await signInWithGoogle();
      else if (provider === 'facebook') await signInWithFacebook();
      else signInWithWeChat();
    } catch (err) {
      setError((err as Error).message || 'Unable to start sign-in.');
      setSocialLoading(null);
    }
  };

  // Accounts that signed up but never entered their code get a fresh one
  // and land back on the confirm step instead of a dead-end error.
  const resumeConfirmation = async () => {
    const { error } = await resendConfirmationCode(email);
    if (error) throw error;
    openStep('confirm', t("This email isn't verified yet. We sent a new 6-digit code to {email}.", { email }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (activeMode === 'signup') {
        const { data, error } = await signUp(email, password, name || undefined);
        if (errorName(error) === 'UsernameExistsException') {
          // Cognito reports unconfirmed accounts as existing too; resending
          // only succeeds for those, so a confirmed account keeps the error.
          try {
            await resumeConfirmation();
            return;
          } catch {
            throw new Error(t('An account with this email already exists. Please sign in.'));
          }
        }
        if (error) throw error;

        if (data.confirmed) {
          setInfo(t('Account created. You can sign in now.'));
          switchMode('signin');
        } else {
          openStep('confirm', t('We sent a 6-digit code to {email}.', { email }));
        }
      } else {
        const { error } = await signIn(email, password);
        if (errorName(error) === 'UserNotConfirmedException') {
          await resumeConfirmation();
          return;
        }
        if (error) throw error;
        router.push('/dashboard');
      }
    } catch (err) {
      setError((err as Error).message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const { error } = await confirmSignUp(email, code.trim());
      if (error) throw error;

      // Like Lyrshop, a verified account goes straight in. If the password
      // in the form is stale (e.g. resumed from an old sign-up), fall back
      // to the sign-in form.
      const { error: signInError } = await signIn(email, password);
      if (!signInError) {
        router.push('/dashboard');
        return;
      }
      switchMode('signin');
      setInfo(t('Email verified! You can sign in now.'));
    } catch (err) {
      setError((err as Error).message || 'Could not confirm your account.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    const { error } =
      step === 'reset' ? await resetPassword(email) : await resendConfirmationCode(email);
    if (error) {
      setError(error.message);
    } else {
      setInfo(t('We sent a new code to {email}.', { email }));
      setResendIn(RESEND_COOLDOWN_SECONDS);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError(t('Enter your email above first.'));
      return;
    }
    setError(null);
    setInfo(null);
    const { error } = await resetPassword(email);
    if (error) setError(error.message);
    else openStep('reset', t('We sent a 6-digit reset code to {email}.', { email }));
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const { error } = await confirmResetPassword(email, code.trim(), newPassword);
      if (error) throw error;

      const { error: signInError } = await signIn(email, newPassword);
      if (!signInError) {
        router.push('/dashboard');
        return;
      }
      switchMode('signin');
      setInfo(t('Password updated. You can sign in now.'));
    } catch (err) {
      setError((err as Error).message || 'Could not reset your password.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'confirm' || step === 'reset') {
    const isReset = step === 'reset';
    const inputClass =
      'w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500';

    return (
      <form onSubmit={isReset ? handleReset : handleConfirm} className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {isReset ? t('Reset your password') : t('Verify your email')}
        </h2>
        <p className="text-sm text-gray-600">
          {t("Enter the 6-digit code we sent to {email}. Check your spam folder if it doesn't arrive.", { email })}
        </p>

        <div>
          <label htmlFor="code" className="block text-sm font-medium mb-2 text-gray-700">
            {t('Verification code')}
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            className={inputClass}
            placeholder="123456"
            required
            autoFocus
            disabled={loading}
          />
        </div>

        {isReset && (
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium mb-2 text-gray-700">
              {t('New password')}
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
              required
              minLength={8}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('At least 8 characters with upper and lower case letters, a number and a symbol.')}
            </p>
          </div>
        )}

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}
        {info && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">{info}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2.5 bg-btn text-white font-medium rounded-md hover:bg-btn-hover disabled:opacity-50 transition-colors"
        >
          {loading ? t('Checking…') : isReset ? t('Reset password') : t('Verify and continue')}
        </button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={cancelStep}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            {t('Cancel')}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendIn > 0 || loading}
            className="text-brand-600 hover:text-brand-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {resendIn > 0 ? t('Resend code in {seconds}s', { seconds: resendIn }) : t('Resend code')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {activeMode === 'signup' ? t('Create your account') : t('Welcome back')}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {activeMode === 'signup'
            ? t('Start planning your next tour in seconds.')
            : t('Sign in to manage your tours.')}
        </p>
      </div>

      <div className="space-y-3">
        <SocialButton
          provider="google"
          label={t('Continue with {provider}', { provider: 'Google' })}
          onClick={() => handleSocial('google')}
          disabled={socialLoading !== null}
        />
        <SocialButton
          provider="facebook"
          label={t('Continue with {provider}', { provider: 'Facebook' })}
          onClick={() => handleSocial('facebook')}
          disabled={socialLoading !== null}
        />
        <SocialButton
          provider="wechat"
          label={t('Continue with {provider}', { provider: 'WeChat' })}
          onClick={() => handleSocial('wechat')}
          disabled={socialLoading !== null}
        />
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-500">{t('or continue with email')}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {activeMode === 'signup' && (
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2 text-gray-700">
              {t('Full name')}
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Jane Doe"
              disabled={loading}
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-700">
            {t('Email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="you@example.com"
            required
            disabled={loading}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t('Password')}
            </label>
            {activeMode === 'signin' && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                {t('Forgot password?')}
              </button>
            )}
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="••••••••"
            required
            minLength={8}
            disabled={loading}
          />
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}
        {info && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">{info}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2.5 bg-btn text-white font-medium rounded-md hover:bg-btn-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? t('Loading…') : activeMode === 'signup' ? t('Create account') : t('Sign in')}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600">
        {activeMode === 'signup' ? t('Already have an account?') : t("Don't have an account?")}{' '}
        <button
          type="button"
          onClick={() => switchMode(activeMode === 'signup' ? 'signin' : 'signup')}
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          {activeMode === 'signup' ? t('Sign in') : t('Sign up')}
        </button>
      </p>
    </div>
  );
}
