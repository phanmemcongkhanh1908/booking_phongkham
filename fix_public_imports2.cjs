const fs = require('fs');
const path = 'server/api/public/index.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'import { eq, and, gte, lt, sql } from "drizzle-orm";',
  'import { eq, and, gte, lt, gt, sql } from "drizzle-orm";'
);
content = content.replace(
  'import { ConflictError, BadRequestError, NotFoundError } from "../../core/errors.js";',
  'import { ConflictError, BadRequestError, NotFoundError, ForbiddenError } from "../../core/errors.js";'
);

fs.writeFileSync(path, content);
