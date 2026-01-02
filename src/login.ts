import fs from 'node:fs'
import * as L from './lib/log.ts'
import puppeteer from './puppeteer.ts'

const log = L.makeLogger('log.txt')

const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setBypassCSP(true)
await page.goto('https://linkedin.com')
try {
    await new Promise(resolve => page.once('close', resolve))
}
catch(err) {
    log.E([err])
    log.E('Got error. Will still get cookies')
}

const cookies = await browser.cookies()
log.I('Saving cookies')

fs.writeFileSync('data/cookies.txt', JSON.stringify(cookies))

await browser.close()
