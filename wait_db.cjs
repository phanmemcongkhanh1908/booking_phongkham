const pg = require('pg');
const fs = require('fs');

async function test() {
  let host = process.env.SQL_HOST;
  if (host && host.startsWith('/app/cloudsql/')) {
    if (!fs.existsSync(host)) {
      const dirs = fs.readdirSync('/app/cloudsql/');
      if (dirs.length > 0) {
        host = '/app/cloudsql/' + dirs[0];
      }
    }
  }

  const pool = new pg.Pool({
    host,
    user: process.env.SQL_ADMIN_USER,
    password: process.env.SQL_ADMIN_PASSWORD,
    database: process.env.SQL_DB_NAME,
  });

  for (let i = 0; i < 30; i++) {
    try {
      const res = await pool.query('SELECT NOW()');
      console.log('Connected! Time:', res.rows[0].now);
      process.exit(0);
    } catch (err) {
      console.error('Attempt', i, 'failed:', err.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  process.exit(1);
}
test();
