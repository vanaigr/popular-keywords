import fsp from 'node:fs/promises';
import * as L from './log.ts'
import json5 from 'json5'

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

export function delay(seconds: number) {
    return new Promise<void>(s => setTimeout(s, seconds * 1000))
}

export function toArray(content: string, log: L.Log) {
    const from = content.indexOf('[')
    const to = content.lastIndexOf(']')
    if(from === -1 || to === -1) {
        log.W('Skipping')
        return undefined
    }
    return json5.parse(content.substring(from, to + 1)) as string[]
}

export function toId(name: string) {
    return name
        .toLowerCase()
        .replace(/ *\d*$/, '')
        .replaceAll(/[^a-z0-9#+]/g, '')
        .replace(/\js$/, '')
}
