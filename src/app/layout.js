import { fontVariables } from './fonts';
import './globals.css';

export const metadata = {
  title: { default: 'Binileaf Admin', template: '%s · Binileaf Admin' },
  description: 'Run the Binileaf site without a deploy.',
  robots: { index: false, follow: false },
};

export const viewport = {
  themeColor: '#152B4F',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
