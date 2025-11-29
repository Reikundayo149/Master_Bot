import { getPool } from '../utils/db.mjs';
import dotenv from 'dotenv';
dotenv.config();

async function init() {
  const pool = await getPool();
  const create = `
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[schedules]') AND type in (N'U'))
BEGIN
CREATE TABLE dbo.schedules (
  id INT IDENTITY(1,1) PRIMARY KEY,
  guild_id NVARCHAR(64) NOT NULL,
  channel_id NVARCHAR(64) NULL,
  name NVARCHAR(255) NOT NULL,
  description NVARCHAR(MAX) NULL,
  datetime_iso DATETIMEOFFSET NOT NULL,
  creator_id NVARCHAR(64) NOT NULL,
  location NVARCHAR(255) NULL,
  reminders NVARCHAR(255) NULL,
  created_at DATETIMEOFFSET DEFAULT SYSUTCDATETIME(),
  updated_at DATETIMEOFFSET DEFAULT SYSUTCDATETIME()
);
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[attendees]') AND type in (N'U'))
BEGIN
CREATE TABLE dbo.attendees (
  id INT IDENTITY(1,1) PRIMARY KEY,
  schedule_id INT NOT NULL,
  user_id NVARCHAR(64) NOT NULL,
  joined_at DATETIMEOFFSET DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_attendees_schedule FOREIGN KEY (schedule_id) REFERENCES dbo.schedules(id) ON DELETE CASCADE
);
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[notification_messages]') AND type in (N'U'))
BEGIN
CREATE TABLE dbo.notification_messages (
  id INT IDENTITY(1,1) PRIMARY KEY,
  schedule_id INT NOT NULL,
  channel_id NVARCHAR(64) NOT NULL,
  message_id NVARCHAR(128) NOT NULL,
  reminder_offset_minutes INT NOT NULL,
  sent_at DATETIMEOFFSET DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_notification_schedule FOREIGN KEY (schedule_id) REFERENCES dbo.schedules(id) ON DELETE CASCADE
);
END
`;

  try {
    await pool.request().batch(create);
    console.log('DB tables ensured/created');
  } catch (err) {
    console.error('DB init error:', err);
    process.exitCode = 1;
  } finally {
    // close global connection
    try { await (await getPool()).close(); } catch(e) { /* ignore */ }
  }
}

init();
