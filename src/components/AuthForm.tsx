'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
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

interface AuthFormProps {
  mode?: 'signin' | 'signup';
}

type Step = 'form' | 'confirm' | 'reset-sent';

export function AuthForm({ mode = 'signin' }: AuthFormProps) {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<'signin' | 'signup'>(mode);
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (next: 'signin' | 'signup') => {
    setActiveMode(next);
    setStep('form');
    setError(null);
    setInfo(null);
    setPassword('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (activeMode === 'signup') {
        const { data, error } = await signUp(email, password, name || undefined);
        if (error) throw error;

        if (data.confirmed) {
          setInfo('Account created. You can sign in now.');
          switchMode('signin');
        } else {
          setStep('confirm');
          setInfo(`We sent a confirmation code to ${email}.`);
        }
      } else {
        const { error } = await signIn(email, password);
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
      const { error } = await confirmSignUp(email, code);
      if (error) throw error;
      setInfo('Email confirmed! You can sign in now.');
      setCode('');
      switchMode('signin');
    } catch (err) {
      setError((err as Error).message || 'Could not confirm your account.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    const { error } = await resendConfirmationCode(email);
    if (error) setError(error.message);
    else setInfo(`We sent a new code to ${email}.`);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email above first.');
      return;
    }
    setError(null);
    const { error } = await resetPassword(email);
    if (error) setError(error.message);
    else setStep('reset-sent');
  };

  if (step === 'confirm') {
    return (
      <form onSubmit={handleConfirm} className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Confirm your email</h2>
        <p className="text-sm text-gray-600">Enter the verification code we sent to {email}.</p>

        <div>
          <label htmlFor="code" className="block text-sm font-medium mb-2 text-gray-700">
            Verification code
          </label>
          <input
            id="code"
            inputMode="numeric"
            value={code}
            onChange={e => setCode(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="123456"
            required
            disabled={loading}
          />
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}
        {info && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">{info}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2.5 bg-btn text-white font-medium rounded-md hover:bg-btn-hover disabled:opacity-50 transition-colors"
        >
          {loading ? 'Confirming…' : 'Confirm account'}
        </button>

        <button
          type="button"
          onClick={handleResend}
          className="w-full text-sm text-brand-600 hover:text-brand-700 font-medium"
        >
          Resend code
        </button>
      </form>
    );
  }

  if (step === 'reset-sent') {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
        <p className="text-sm text-gray-600">
          We sent password reset instructions to {email}.
        </p>
        <button
          type="button"
          onClick={() => setStep('form')}
          className="text-sm text-brand-600 hover:text-brand-700 font-medium"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {activeMode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {activeMode === 'signup'
            ? 'Start planning your next tour in seconds.'
            : 'Sign in to manage your tours.'}
        </p>
      </div>

      <div className="space-y-3">
        <SocialButton
          provider="google"
          label="Continue with Google"
          onClick={() => handleSocial('google')}
          disabled={socialLoading !== null}
        />
        <SocialButton
          provider="facebook"
          label="Continue with Facebook"
          onClick={() => handleSocial('facebook')}
          disabled={socialLoading !== null}
        />
        <SocialButton
          provider="wechat"
          label="Continue with WeChat"
          onClick={() => handleSocial('wechat')}
          disabled={socialLoading !== null}
        />
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-500">or continue with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {activeMode === 'signup' && (
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2 text-gray-700">
              Full name
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
            Email
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
              Password
            </label>
            {activeMode === 'signin' && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Forgot password?
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
          {loading ? 'Loading…' : activeMode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600">
        {activeMode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type="button"
          onClick={() => switchMode(activeMode === 'signup' ? 'signin' : 'signup')}
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          {activeMode === 'signup' ? 'Sign in' : 'Sign up'}
        </button>
      </p>
    </div>
  );
}
