export const metadata = {
  title: 'Liar Game Multiplayer',
  description: 'Real-time Multiplayer Liar Game',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f8fafc' }}>{children}</body>
    </html>
  );
}
