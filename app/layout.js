import './globals.css'

export const metadata = {
  title: 'Avalon Online',
  description: 'The Resistance: Avalon',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
