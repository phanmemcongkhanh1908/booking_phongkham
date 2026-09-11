const fs = require('fs');
const path = 'src/pages/admin/Settings.tsx';
let content = fs.readFileSync(path, 'utf8');

const modalRender = `
      {isDiagnosticOpen && (
        <SyncDiagnosticModal 
          onClose={() => setIsDiagnosticOpen(false)}
          onForceSyncAll={handleForceSyncAllAppointments}
        />
      )}
`;

if (!content.includes('<SyncDiagnosticModal')) {
    content = content.replace(
        /    <\/div>\n  \);\n\}\n?$/,
        modalRender + "    </div>\n  );\n}\n"
    );
}

fs.writeFileSync(path, content);
console.log('Patched Settings.tsx modal render');
