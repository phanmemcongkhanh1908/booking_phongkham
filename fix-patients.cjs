const fs = require('fs');

let content = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');

// Insert the DocumentViewer component at the end of the main div
const componentStr = `      {/* Document Viewer Modal */}
      {documentViewerState.isOpen && documentViewerState.type && selectedPatient && (
        <DocumentViewer 
          isOpen={documentViewerState.isOpen}
          type={documentViewerState.type}
          patient={selectedPatient}
          records={selectedPatient.emr || []}
          receiptData={{
            total: currentServiceCost,
            paid: paidAmount,
            newDebt: Math.max(0, debt + currentServiceCost - paidAmount),
            oldDebt: selectedPatient.debt
          }}
          onClose={() => setDocumentViewerState({isOpen: false, type: null})}
          onSendSuccess={(telegramId) => {
            setSelectedPatient({...selectedPatient, telegramId});
            setPatients(patients.map(p => p.id === selectedPatient.id ? {...p, telegramId} : p));
          }}
        />
      )}
    </div>
  );
}`;

content = content.replace(/    <\/div>\n  \);\n\}/, componentStr);

// Manually slice out the old rendering logic.
// The old rendering logic starts from `{/* Print Templates rendered directly into the DOM */}` 
// and goes all the way down to just before the closing `</div>\n  );\n}`.

const startMarker = "{/* Print Templates rendered directly into the DOM */}";
let startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
  // Let's look for something else.
  startIndex = content.indexOf("{/* Hidden templates for html2canvas to capture */}");
}

if (startIndex !== -1) {
  // We found it, now let's find where to cut.
  const endMarker = "{/* Document Viewer Modal */}";
  const endIndex = content.indexOf(endMarker);
  
  if (endIndex !== -1 && endIndex > startIndex) {
    // There is probably some closing tags between startMarker and the end of the div.
    // Wait, the templates are inside the main `div className="flex h-screen overflow-hidden"`
    // Let's just do a regex replace.
    const partToReplace = content.substring(startIndex, endIndex);
    content = content.replace(partToReplace, "");
  }
}

fs.writeFileSync('src/pages/admin/Patients.tsx', content);

