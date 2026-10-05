import './globals.css';
import { TournamentProvider } from '../lib/tournament-context';

export const metadata = {
  title: 'SPIKE CUP 26 Tournament Manager',
  description: 'Tournament draw, fixtures, standings and administration for SPIKE CUP 26.'
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f8fc' },
    { media: '(prefers-color-scheme: dark)', color: '#07111f' }
  ],
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem('spike-cup-theme');
                const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                document.documentElement.dataset.theme = theme;
                document.documentElement.style.colorScheme = theme;
              } catch {}
            `
          }}
        />
      </head>
      <body>
        <TournamentProvider>{children}</TournamentProvider>
      </body>
    </html>
  );
}
