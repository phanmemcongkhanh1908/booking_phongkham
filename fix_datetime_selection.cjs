const fs = require('fs');
const path = 'src/pages/public/components/DateTimeSelection.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { useNavigate }')) {
  content = content.replace(
    "import { format, startOfToday, addDays, isSameDay, parseISO } from 'date-fns';",
    "import { format, startOfToday, addDays, isSameDay, parseISO } from 'date-fns';\nimport { useNavigate } from 'react-router-dom';"
  );
}

if (!content.includes('const navigate = useNavigate();')) {
  content = content.replace(
    'const [holding, setHolding] = useState(false);',
    'const [holding, setHolding] = useState(false);\n  const navigate = useNavigate();'
  );
}

content = content.replace(
  '        setDateTimeSlot(\n          format(selectedDate, \'yyyy-MM-dd\'),\n          slot.providerId,\n          res.data.data.sessionToken,\n          slot.startAt,\n          slot.endAt,\n          res.data.data.expiresAt\n        );',
  '        setDateTimeSlot(\n          format(selectedDate, \'yyyy-MM-dd\'),\n          slot.providerId,\n          res.data.data.sessionToken,\n          slot.startAt,\n          slot.endAt,\n          res.data.data.expiresAt\n        );\n        navigate(\'/book/thong-tin\');'
);

fs.writeFileSync(path, content);
