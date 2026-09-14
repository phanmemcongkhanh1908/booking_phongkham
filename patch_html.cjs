const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const iosMetaTags = `
    <meta name="theme-color" content="#ffffff" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="DentalApp" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
`;

content = content.replace("<!-- Thêm PWA Manifest -->", iosMetaTags + "\n    <!-- Thêm PWA Manifest -->");
fs.writeFileSync('index.html', content);
