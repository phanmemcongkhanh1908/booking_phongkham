const pg = require('pg');
const pool = new pg.Pool({
  host: '/app/cloudsql/gen-lang-client-0846632471:asia-southeast1:ai-studio-a533719e',
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DB_NAME,
});
pool.query('SELECT NOW()')
  .then(res => console.log('Connected! Time:', res.rows[0].now))
  .catch(err => console.error('Connection error:', err))
  .finally(() => pool.end());
