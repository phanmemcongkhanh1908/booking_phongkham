const fs = require('fs');
const path = 'server.ts';
let content = fs.readFileSync(path, 'utf8');

const replacement = `
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(\`[Server] Dental Smart Booking Engine running on port \${PORT}\`);
  });

  // ==========================================
  // VITE MIDDLEWARE (For React PWA)
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}
`;

content = content.replace(
  /  \/\/ ==========================================\n  \/\/ VITE MIDDLEWARE \(For React PWA\)\n  \/\/ ==========================================\n  if \(process\.env\.NODE_ENV !== "production"\) {[\s\S]*?app\.listen\(PORT, "0\.0\.0\.0", \(\) => {[\s\S]*?console\.log\(`\[Server\] Dental Smart Booking Engine running on port \${PORT}`\);\n  }\);\n}/m,
  replacement.trim() + "\n"
);

fs.writeFileSync(path, content);
