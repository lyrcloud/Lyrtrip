import Link from 'next/link';

const linkClass = 'inline-block py-1 hover:text-brand-600';

/**
 * Site-wide footer, rendered from the root layout
 */
export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 sm:gap-8 mb-8">
          <div>
            <h3 className="font-bold text-gray-900 mb-3 sm:mb-4">About</h3>
            <ul className="space-y-1 sm:space-y-2 text-sm text-gray-600">
              <li><a href="#" className={linkClass}>About Us</a></li>
              <li><a href="#" className={linkClass}>Blog</a></li>
              <li><a href="#" className={linkClass}>Careers</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-3 sm:mb-4">Support</h3>
            <ul className="space-y-1 sm:space-y-2 text-sm text-gray-600">
              <li><a href="#" className={linkClass}>Help Center</a></li>
              <li><a href="#" className={linkClass}>Contact Us</a></li>
              <li><a href="#" className={linkClass}>FAQ</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-3 sm:mb-4">Legal</h3>
            <ul className="space-y-1 sm:space-y-2 text-sm text-gray-600">
              <li><Link href="/privacy" className={linkClass}>Privacy Policy</Link></li>
              <li><Link href="/data-deletion" className={linkClass}>Data Deletion</Link></li>
              <li><a href="#" className={linkClass}>Terms of Service</a></li>
              <li><a href="#" className={linkClass}>Cookies</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-3 sm:mb-4">Follow</h3>
            <ul className="space-y-1 sm:space-y-2 text-sm text-gray-600">
              <li><a href="#" className={linkClass}>Facebook</a></li>
              <li><a href="#" className={linkClass}>Twitter</a></li>
              <li><a href="#" className={linkClass}>Instagram</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-6 sm:pt-8 flex flex-col-reverse sm:flex-row justify-between items-center gap-3 text-center sm:text-left">
          <p className="text-sm text-gray-600">&copy; 2026 Lyrtrip. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <a href="#" className="text-sm text-gray-600 hover:text-brand-600">Sitemap</a>
            <a href="#" className="text-sm text-gray-600 hover:text-brand-600">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
