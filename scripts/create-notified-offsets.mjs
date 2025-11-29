import { getPool } from '../utils/db.mjs';

(async () => {
  try {
    const pool = await getPool();
    const createSql = `
CREATE TABLE dbo.notified_offsets (
  id INT IDENTITY(1,1) PRIMARY KEY,
  schedule_id INT NOT NULL,
  offset_minutes INT NOT NULL,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSUTCDATETIME()
);
`;
    console.log('Creating table dbo.notified_offsets...');
    await pool.request().query(createSql);
    console.log('Table dbo.notified_offsets created (or already exists).');
    try { await pool.close(); } catch (e) { /* ignore close errors */ }
    process.exit(0);
  } catch (err) {
    console.error('Failed to create notified_offsets table:', err);
    try { (await getPool()).close(); } catch (e) {}
    process.exit(1);
  }
})();
