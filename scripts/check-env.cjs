/**
 * 环境自检脚本：验证 Electron 主进程环境下 SQLite 驱动（better-sqlite3 / node:sqlite）可用性。
 * 运行方式：npx electron scripts/check-env.cjs
 */
const { app } = require('electron')

app.whenReady().then(() => {
  console.log('ELECTRON', process.versions.electron, 'NODE', process.versions.node, 'CHROME', process.versions.chrome)

  try {
    const Database = require('better-sqlite3')
    const db = new Database(':memory:')
    db.exec('CREATE TABLE t (a INTEGER); INSERT INTO t VALUES (1);')
    const count = db.prepare('SELECT COUNT(*) AS c FROM t').get().c
    db.close()
    console.log('BETTER_SQLITE3_OK', count)
  } catch (err) {
    console.log('BETTER_SQLITE3_FAIL', err.message)
  }

  try {
    const { DatabaseSync } = require('node:sqlite')
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE t (a INTEGER); INSERT INTO t VALUES (2);')
    const count = db.prepare('SELECT COUNT(*) AS c FROM t').get().c
    db.close()
    console.log('NODE_SQLITE_OK', count)
  } catch (err) {
    console.log('NODE_SQLITE_FAIL', err.message)
  }

  app.quit()
})