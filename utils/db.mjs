import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.AZURE_SQL_CONNECTION;
if (!connStr) {
  throw new Error('AZURE_SQL_CONNECTION が環境変数に設定されていません');
}

let poolPromise = null;
export function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(connStr);
  }
  return poolPromise;
}

export default getPool;
