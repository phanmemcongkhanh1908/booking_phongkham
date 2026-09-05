const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');

const startStr = "      {/* ======================================================== */}\n      {/* PRINT VIEWS (Hidden on screen, visible on print)         */}";
const endStr = "      </div>\n\n      {/* Document Viewer Modal */}";

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + "      {/* Document Viewer Modal */}";
  const rest = content.substring(endIdx + endStr.length);
  // Wait, I messed up the substring logic if I do that. Let's just use string replace.
}
