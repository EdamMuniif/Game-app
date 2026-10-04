import './globals.css';
import { TournamentProvider } from '../lib/tournament-context';

export const metadata = {
  title: 'SPIKE CUP 26 Tournament Manager',
  description: 'Tournament draw, fixtures, standings and administration for SPIKE CUP 26.'
};

export const viewport = {
  themeColor: '#082b5c',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <TournamentProvider>{children}</TournamentProvider>
      </body>
    </html>
  );
}
