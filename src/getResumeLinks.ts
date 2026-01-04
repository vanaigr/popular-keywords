import puppeteer from './puppeteer.ts'
import fs from 'node:fs'
import * as U from './lib/util.ts'
import * as L from './lib/log.ts'

const log = L.makeLogger('log.txt')

const linksPath = './data/resumeLinks.json'
const allLinks = new Set(await U.readJson<string[]>(linksPath, [], log))

const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
})
const page = await browser.newPage()

for(let i = 1;; i++) {
    log.I('Processing page ', [i])

    const url = new URL('https://www.postjobfree.com/resumes?q=full+stack+developer&n=&t=&d=&l=Lebanon%2C+KS&radius=1800&r=100')
    url.searchParams.set('p', '' + i)
    await page.goto(url.toString(), { waitUntil: 'networkidle2' })

    const result = await page.evaluate(() => {
        const urls = new Set<string>()
        const errors: string[] = []

        const elements = [...document.querySelectorAll('.snippetPadding')]
        for(const element of elements) {
            try {
                const url = element.querySelector('a')!.href
                urls.add(url)
            }
            catch(err) {
                errors.push('' + err)
            }
        }

        return { urls: [...urls], errors }
    })

    for(const err of result.errors) log.E('While getting links: ', [err])

    if(result.urls.length === 0) break
    for(const url of result.urls) allLinks.add(url)

    fs.writeFileSync(linksPath, JSON.stringify([...allLinks]))

    await U.delay(2)
}
