const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/components/DocumentViewer.tsx', 'utf8');

const newPdfLogic = `
        let pdfFormat: any = type === 'receipt' ? 'a5' : 'a4';
        if (type === 'receipt' && printFormat === 'k80') {
          // K80 is 80mm width. Height depends on canvas ratio.
          const ratio = canvas.height / canvas.width;
          pdfFormat = [80, 80 * ratio];
        }
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: pdfFormat
        });
`;

content = content.replace(
  /const pdf = new jsPDF\(\{\s*orientation: 'portrait',\s*unit: 'mm',\s*format: type === 'receipt' \? 'a5' : 'a4'\s*\}\);/g,
  newPdfLogic
);

fs.writeFileSync('src/pages/admin/components/DocumentViewer.tsx', content);
