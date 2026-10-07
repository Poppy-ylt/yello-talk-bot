import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Yello Music Bot',
  description: 'Local YelloTalk music bot control panel.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body>{children}</body></html>
}
