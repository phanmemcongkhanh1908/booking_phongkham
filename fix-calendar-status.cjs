const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/CalendarView.tsx', 'utf8');

// Also update CalendarView.tsx for consistency

const importStatement = `import { APPOINTMENT_STATUSES, LABEL_OVERRIDES } from '../../constants/appointmentStatus';`;
if (!content.includes('APPOINTMENT_STATUSES')) {
  content = content.replace(
    "import { format, addDays, startOfWeek, isSameDay, parseISO, startOfDay, addMinutes, isBefore } from 'date-fns';",
    "import { format, addDays, startOfWeek, isSameDay, parseISO, startOfDay, addMinutes, isBefore } from 'date-fns';\nimport { APPOINTMENT_STATUSES, LABEL_OVERRIDES } from '../../constants/appointmentStatus';"
  );
}

// Find {apt.status}
const statusRenderBlock = `
                    <span 
                      className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide"
                      style={{ 
                        backgroundColor: APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.color || 'var(--text-muted)',
                        color: 'white'
                      }}
                    >
                      {LABEL_OVERRIDES[apt.status] || APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.label || apt.status}
                    </span>
`;

content = content.replace(
  /<span className=\{\`inline-block mt-1 px-1\.5 py-0\.5 rounded text-\[10px\] font-bold tracking-wide \$\{getStatusColor\(apt\.status\)\}\`\}>\s*\{apt\.status\}\s*<\/span>/,
  statusRenderBlock
);

fs.writeFileSync('src/pages/admin/CalendarView.tsx', content);
