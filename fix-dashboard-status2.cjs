const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Dashboard.tsx', 'utf8');

// The getStatusColor from before looks like: `bg-status-confirmed-bg text-status-confirmed`
// These are tailwind classes from tailwind.config.js? No, from index.css.
// Actually, let's just use APPOINTMENT_STATUSES from our constants.

const importStatement = `import { APPOINTMENT_STATUSES } from '../../constants/appointmentStatus';`;
if (!content.includes(importStatement)) {
  content = content.replace(
    "import { format, parseISO } from 'date-fns';",
    "import { format, parseISO } from 'date-fns';\nimport { APPOINTMENT_STATUSES, LABEL_OVERRIDES } from '../../constants/appointmentStatus';"
  );
}

const renderStatusBlock = `
                          <span 
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                            style={{ 
                              backgroundColor: APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.bg || 'var(--bg-muted)', 
                              color: APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.color || 'var(--text-muted)',
                              border: \`1px solid \${APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.color || 'transparent'}40\`
                            }}
                          >
                            {LABEL_OVERRIDES[apt.status] || APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.label || apt.status}
                          </span>
`;

// Replace the span
content = content.replace(
  /<span className=\{\`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium \$\{getStatusColor\(apt\.status\)\}\`\}>[\s\S]*?<\/span>/,
  renderStatusBlock
);

fs.writeFileSync('src/pages/admin/Dashboard.tsx', content);
