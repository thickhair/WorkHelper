/**
 * better-sqlite3 最小类型声明（该包未内置类型定义）。
 * 仅声明本项目使用到的 API，降低类型依赖。
 */
declare module 'better-sqlite3' {
  interface RunResult {
    changes: number | bigint
    lastInsertRowid: number | bigint
  }

  interface Statement {
    run(...params: unknown[]): RunResult
    get(...params: unknown[]): unknown
    all(...params: unknown[]): unknown[]
    iterate(...params: unknown[]): IterableIterator<unknown>
  }

  interface DatabaseOptions {
    readonly?: boolean
    fileMustExist?: boolean
    timeout?: number
    verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void
  }

  class Database {
    constructor(filename: string | Buffer, options?: DatabaseOptions)
    prepare(sql: string): Statement
    exec(sql: string): this
    pragma(pragma: string, options?: { simple?: boolean }): unknown
    transaction<F extends (...args: never[]) => unknown>(fn: F): F
    close(): this
    readonly open: boolean
  }

  export = Database
}