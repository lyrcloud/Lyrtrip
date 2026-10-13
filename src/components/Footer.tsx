import Link from 'next/link';

const linkClass = 'py-0.5 hover:text-brand-600';

const groups: { title: string; links: { label: string; href: string; internal?: boolean }[] }[] = [
  { title: 'About', links: [{ label: 'About Us', href: '#' }, { label: 'Blog', href: '#' }, { label: 'Careers', href: '#' }] },
  { title: 'Support', links: [{ label: 'Help Center', href: '#' }, { label: 'Contact Us', href: '#' }, { label: 'FAQ', href: '#' }] },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy', internal: true },
      { label: 'Data Deletion', href: '/data-deletion', internal: true },
      { label: 'Terms', href: '#' },
      { label: 'Cookies', href: '#' },
    ],
  },
  { title: 'Follow', links: [{ label: 'Facebook', href: '#' }, { label: 'Twitter', href: '#' }, { label: 'Instagram', href: '#' }] },
];

/**
 * Site-wide footer, rendered from the root layout
 */
export default function Footer() {
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
        <p className="shrink-0">&copy; 2026 Lyrtrip. All rights reserved.</p>
      </div>
    </footer>
  );
}
