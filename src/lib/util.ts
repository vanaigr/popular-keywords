import fsp from 'node:fs/promises';
import * as L from './log.ts'

export async function readJson<T>(path: string, fallback: T, log: L.Log): Promise<T> {
    try {
        return JSON.parse(await fsp.readFile(path, 'utf8'));
    }
    catch (err: any) {
        if (err.code !== 'ENOENT') {
            log.E('While reading ', [path], ': ', [err])
        }
        return fallback;
    }
}

export function getHash(...fields: unknown[]) {
  let result = '';
  for (const it of fields) {
    const el = '' + it;
    result += el.length.toString(36) + '$' + el;
  }
  return result;
}
