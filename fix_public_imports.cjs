const fs = require('fs');
const path = 'server/api/public/index.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'import { eq, and, lt, lte, gte } from "drizzle-orm";',
  'import { eq, and, lt, lte, gte, gt } from "drizzle-orm";'
);
content = content.replace(
  'import { NotFoundError, BadRequestError } from "../../core/errors.js";',
  'import { NotFoundError, BadRequestError, ForbiddenError } from "../../core/errors.js";'
);

fs.writeFileSync(path, content);
