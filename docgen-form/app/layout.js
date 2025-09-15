export const metadata = { title: '文档生成器', description: '表单生成 DOCX' };

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body style={{fontFamily:'system-ui, -apple-system, Segoe UI, Roboto', margin:0}}>
        {children}
      </body>
    </html>
  );
}
