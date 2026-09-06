const fs = require('fs');
const path = 'server/db/index.ts';
let content = fs.readFileSync(path, 'utf8');

const newCreatePool = `
import fs from "fs";

export const createPool = () => {
  if (!global._postgresPool) {
    let host = process.env.SQL_HOST;
    
    if (host && host.startsWith('/app/cloudsql/')) {
      if (!fs.existsSync(host)) {
        try {
          const dirs = fs.readdirSync('/app/cloudsql/');
          if (dirs.length > 0) {
            host = '/app/cloudsql/' + dirs[0];
            console.log(\`[DB] Auto-corrected SQL_HOST to: \${host}\`);
          }
        } catch (e) {
          console.error("[DB] Failed to auto-detect socket:", e);
        }
      }
    }

    global._postgresPool = new pg.Pool({
      host,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};
`;

content = content.replace(/export const createPool = \(\) => \{[\s\S]*?return global\._postgresPool;\n\};/, newCreatePool.trim());

fs.writeFileSync(path, content);
