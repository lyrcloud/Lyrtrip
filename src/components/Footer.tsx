'use client';

import Link from 'next/link';
import { useLocale } from '@/i18n/LocaleContext';

const linkClass = 'py-0.5 hover:text-brand-600';

/**
 * Site-wide footer, rendered from the root layout
 */
export default function Footer() {
  const { t } = useLocale();
  const groups: { title: string; links: { label: string; href: string; internal?: boolean }[] }[] = [
    { title: t('About'), links: [{ label: t('About Us'), href: '#' }, { label: t('Blog'), href: '#' }, { label: t('Careers'), href: '#' }] },
    {
      title: t('Support'),
      links: [
        { label: t('Help Center'), href: 'https://wa.me/16615809465' },
        { label: t('Contact Us'), href: 'mailto:support@lyrtrip.com' },
        { label: t('FAQ'), href: '#' },
      ],
    },
    {
      title: t('Legal'),
      links: [
        { label: t('Privacy'), href: '/privacy', internal: true },
        { label: t('Data Deletion'), href: '/data-deletion', internal: true },
        { label: t('Terms'), href: '#' },
        { label: t('Cookies'), href: '#' },
      ],
    },
    { title: t('Follow'), links: [{ label: 'Facebook', href: '#' }, { label: 'Twitter', href: '#' }, { label: 'Instagram', href: '#' }] },
  ];
  return (
    <footer className="border-t border-gray-200 bg-white text-xs text-gray-600 print:hidden">
      <div className="mx-auto max-w-screen-2xl px-4 py-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <nav className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 gap-y-2">
          {groups.map((group) => (
            <div key={group.title} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="font-semibold text-gray-900">{group.title}</span>
              {group.links.map((link) =>
                link.internal ? (
                  <Link key={link.label} href={link.href} className={linkClass}>{link.label}</Link>
                ) : (
                  <a key={link.label} href={link.href} className={linkClass}>{link.label}</a>
                )
              )}
            </div>
          ))}
        </nav>
        <p className="shrink-0">&copy; 2026 Lyrtrip. {t('All rights reserved.')}</p>
      </div>
    </footer>
  );
}
