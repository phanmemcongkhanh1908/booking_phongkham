const fs = require('fs');
const path = 'src/pages/admin/CalendarView.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { useMobile } from')) {
    content = content.replace("import React, { useState, useMemo } from 'react';", "import React, { useState, useMemo, useEffect } from 'react';\nimport { useMobile } from '../../hooks/useMobile';");
}

if (!content.includes('const isMobile = useMobile()')) {
    content = content.replace(
        "const [view, setView] = useState<View>(Views.WEEK);",
        `const isMobile = useMobile();
  const [view, setView] = useState<View>(Views.WEEK);

  useEffect(() => {
    if (isMobile) {
      setView(Views.AGENDA);
    } else {
      setView(Views.WEEK);
    }
  }, [isMobile]);`
    );
}

fs.writeFileSync(path, content);
console.log('Patched CalendarView.tsx');
