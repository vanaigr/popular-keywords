import puppeteer from './puppeteer.ts'
import fs from 'node:fs'
import * as U from './lib/util.ts'
import * as L from './lib/log.ts'

type Resume = {
    fetchTime: number
    title: string
    location: string
    text: string
}

const log = L.makeLogger('log.txt')

const allLinks: string[] = JSON.parse(fs.readFileSync('./data/resumeLinks.json').toString())

const resumesPath = './data/resumes.json'
const resumes = await U.readJson<Record<string, Resume>>(resumesPath, {}, log)

const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
})
const page = await browser.newPage()

for(let i = 0; i < allLinks.length; i++) {
    const link = allLinks[i]
    if(resumes[link] !== undefined) continue

    log.I('Parsing link ', [i], ' of ', [allLinks.length])

    await page.goto(link, { waitUntil: 'networkidle2' })
    const result = await page.evaluate(() => {
        const title = document.querySelector('h1')?.textContent ?? ''

        const location = document.evaluate(
            `//*[text() = 'Location:']/following::*`,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE
        ).singleNodeValue?.textContent ?? ''

        const text = getTextLines(
            document.evaluate(
                `//*[text() = 'Resume:']/following::*`,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE
            ).singleNodeValue! as HTMLElement
        )

        function getTextLines(el: HTMLElement) {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const parts = [];
            let node;
            while (node = walker.nextNode()) {
                parts.push((node.nodeValue ?? '').trim());
            }
            return parts.filter(Boolean).join('\n').trim();
        }

        return { title, location, text }
    })

    resumes[link] = { ...result, fetchTime: Date.now() }

    fs.writeFileSync(resumesPath, JSON.stringify(resumes))

    await U.delay(1)
}

log.I('Done')

await browser.close()
