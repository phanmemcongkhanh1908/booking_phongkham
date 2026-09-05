const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const themeScript = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script>
      (function() {
        try {
          const THEME_STORAGE_KEY = 'dental_smart_theme_preference';
          const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
          let isDark = false;
          if (storedTheme === 'dark') {
            isDark = true;
          } else if (storedTheme === 'system') {
            isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          }
          if (isDark) {
            document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
          } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.setAttribute('data-theme', 'light');
          }
        } catch (e) {}
      })();
    </script>
`;

if (!html.includes('THEME_STORAGE_KEY')) {
  html = html.replace('</head>', themeScript + '</head>');
  fs.writeFileSync('index.html', html);
}
