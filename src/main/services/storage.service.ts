/**
 * 数据存储位置服务：支持在设置页更改数据库存放目录。
 * 目录配置保存在 userData 根目录的 storage.json（与数据库分离，便于定位）；
 * 更改时先把数据复制到新目录再切换（原目录文件保留，作为兜底备份）。
 */
import { app, dialog, type BrowserWindow } from 'electron'
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  closeDb,
  getDataDir,
  getDb,
  getDbPath,
  setDataDirOverride
} from '../db/database'
import type { StorageInfo } from '@shared/types'

/** 目录配置文件名（位于 userData 根目录） */
const CONFIG_FILE = 'storage.json'
/** 新位置下存放数据的子目录名 */
const SUB_DIR = 'Workbench'
/** 数据库附属文件后缀（WAL 模式） */
const DB_SUFFIXES = ['', '-wal', '-shm']

interface StorageConfig {
  /** 自定义数据目录（绝对路径） */
  dataDir?: string
}

function configPath(): string {
  return join(app.getPath('userData'), CONFIG_FILE)
}

function readConfig(): StorageConfig {
  try {
    return JSON.parse(readFileSync(configPath(), 'utf8')) as StorageConfig
  } catch {
    return {}
  }
}

function writeConfig(config: StorageConfig): void {
  writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf8')
}

/** 便携模式：由环境变量固定数据目录（不读取 / 不写入目录配置） */
function isPortable(): boolean {
  return Boolean(process.env['WORKBENCH_DATA_DIR'])
}

/** 默认数据目录（未应用自定义配置时的目录） */
function defaultDataDir(): string {
  return join(app.getPath('userData'), 'data')
}

export const storageService = {
  /**
   * 启动时应用已保存的存储位置配置（便携模式优先）。
   * 目录不可用时回退到默认位置，避免应用无法启动。
   */
  init(): string {
    if (isPortable()) return getDataDir()
    const dir = readConfig().dataDir
    if (dir) {
      try {
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        setDataDirOverride(dir)
      } catch (err) {
        console.error('[storage] 自定义数据目录不可用，回退默认位置：', err)
      }
    }
    return getDataDir()
  },

  info(): StorageInfo {
    return {
      dataPath: getDbPath(),
      dataDir: getDataDir(),
      custom: !isPortable() && Boolean(readConfig().dataDir),
      portable: isPortable()
    }
  },

  /**
   * 打开目录选择对话框并切换数据存储位置：
   * 校验目标目录 → 检查点并关闭数据库 → 复制数据库文件 → 写入配置 → 重新打开。
   * 返回新的数据库文件路径；用户取消或校验失败时抛出友好错误 / 返回 null。
   */
  async change(win: BrowserWindow | null): Promise<string | null> {
    if (isPortable()) throw new Error('便携模式下数据目录由启动参数指定，无法在应用内更改')
    const properties: Array<'openDirectory' | 'createDirectory'> = ['openDirectory', 'createDirectory']
    const options = { title: '选择数据存储位置', buttonLabel: '选择此文件夹', properties }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null

    const targetDir = join(result.filePaths[0], SUB_DIR)
    if (targetDir === getDataDir()) throw new Error('该文件夹已是当前数据存储位置')
    const targetDb = join(targetDir, 'workbench.db')
    if (existsSync(targetDb)) {
      throw new Error(`该文件夹中已存在 Workbench 数据（${targetDb}），请选择其他文件夹`)
    }

    mkdirSync(targetDir, { recursive: true })

    const previousDir = getDataDir()
    const sourceDb = getDbPath()
    try {
      // WAL 内容合并回主库后再关闭，保证复制的数据库文件完整
      getDb().exec('PRAGMA wal_checkpoint(TRUNCATE)')
      closeDb()
      for (const suffix of DB_SUFFIXES) {
        const from = `${sourceDb}${suffix}`
        if (existsSync(from)) copyFileSync(from, `${targetDb}${suffix}`)
      }
      // 书籍文件（阅读模块）随数据目录一并迁移
      const sourceBooks = join(previousDir, 'books')
      if (existsSync(sourceBooks)) {
        cpSync(sourceBooks, join(targetDir, 'books'), { recursive: true })
      }
    } catch (err) {
      // 复制失败：回退到原位置，保证应用可继续使用
      setDataDirOverride(previousDir === defaultDataDir() ? null : previousDir)
      void getDb()
      throw new Error(`更改数据存储位置失败：${(err as Error).message}`)
    }

    writeConfig({ dataDir: targetDir })
    setDataDirOverride(targetDir)
    try {
      getDb()
    } catch (err) {
      throw new Error(`数据已复制到新位置，但重新打开失败（${(err as Error).message}），请重启应用`)
    }
    return getDbPath()
  }
}