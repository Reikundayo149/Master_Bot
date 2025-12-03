// `utils/db.mjs` removed — DB helper disabled as part of Azure cleanup.
export function getPool() {
  throw new Error('DB helper disabled: utils/db.mjs was removed as part of cleanup.');
}

export default getPool;
