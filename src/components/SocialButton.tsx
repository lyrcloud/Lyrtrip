'use client';

type Provider = 'google' | 'facebook' | 'wechat';

interface SocialButtonProps {
  provider: Provider;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const icons: Record<Provider, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.43-.22-2.06H12v3.9h6.55c-.13 1.08-.85 2.71-2.44 3.8l-.02.15 3.55 2.75.25.02c2.26-2.09 3.63-5.16 3.63-8.56z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.78-2.92c-1.01.7-2.37 1.19-4.15 1.19-3.17 0-5.86-2.09-6.82-4.99l-.14.01-3.7 2.86-.05.13C3.27 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.18 14.37A7.36 7.36 0 0 1 4.78 12c0-.82.14-1.62.38-2.37l-.01-.16-3.75-2.91-.12.06A11.96 11.96 0 0 0 0 12c0 1.93.46 3.76 1.28 5.38l3.9-3.01z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c2.26 0 3.78.97 4.65 1.79l3.39-3.31C17.94 1.19 15.24 0 12 0 7.31 0 3.27 2.7 1.28 6.62l3.89 3.01C6.14 6.84 8.83 4.75 12 4.75z"
      />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6 4.39 10.98 10.13 11.86v-8.39H7.08v-3.47h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.95.93-1.95 1.89v2.27h3.32l-.53 3.47h-2.79v8.39C19.61 23.05 24 18.07 24 12.07z"
      />
    </svg>
  ),
  wechat: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#09B83E"
        d="M8.69 2.5C4.07 2.5.5 5.66.5 9.56c0 2.27 1.27 4.21 3.27 5.5l-.6 2.05a.45.45 0 0 0 .67.52l2.18-1.25c.69.19 1.42.31 2.18.34a6.4 6.4 0 0 1-.2-1.59c0-3.95 3.72-7.15 8.31-7.15.2 0 .4 0 .6.02C16.16 4.46 12.78 2.5 8.69 2.5zm-2.5 4.4a1.07 1.07 0 1 1 0 2.14 1.07 1.07 0 0 1 0-2.14zm5 0a1.07 1.07 0 1 1 0 2.14 1.07 1.07 0 0 1 0-2.14z"
      />
      <path
        fill="#09B83E"
        d="M23.5 14.85c0-3.16-3.13-5.72-6.99-5.72-3.87 0-7 2.56-7 5.72s3.13 5.71 7 5.71c.65 0 1.27-.08 1.86-.22l1.85 1.06a.38.38 0 0 0 .57-.44l-.46-1.65c1.9-1.07 3.17-2.79 3.17-4.46zm-9.21-1.07a.89.89 0 1 1 0-1.79.89.89 0 0 1 0 1.79zm4.43 0a.89.89 0 1 1 0-1.79.89.89 0 0 1 0 1.79z"
      />
    </svg>
  ),
};

/**
 * A branded "Continue with ___" button used on the sign-in/sign-up form.
 */
export function SocialButton({ provider, label, onClick, disabled }: SocialButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icons[provider]}
      {label}
    </button>
  );
}
