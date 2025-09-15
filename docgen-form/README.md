# DocGen Form

表单式生成 DOCX（支持中文文件名）。包含 Invoice 与 确认函（万咖/多吉）。

## 本地 Docker 运行
```powershell
docker build -t docgen:latest .

docker run --rm -p 3000:3000 `
  -v "$($PWD.Path)\templates:/app/templates:ro" `
  -v "$($PWD.Path)\templates.config.json:/app/templates.config.json:ro" `
  -v "$($PWD.Path)\seals:/app/seals:ro" `
  docgen:latest
```

打开 http://localhost:3000

## 开发（无需 Docker）
```bash
npm install
npm run dev
```

## 模板占位符
模板中使用 `[占位符]` 写法（如 `[invoiceNo]`），程序会自动转换为 `docx-templates` 的 `{…}` 语法进行渲染。
