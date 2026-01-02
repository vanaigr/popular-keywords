import puppeteer from './puppeteer.ts'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import * as L from './lib/log.ts'
import config from '../config.ts'

type Job = {
    jobId: string | null
    company: string | null
    title: string | null
    preferences: string[]
    description: string

    previous?: Job
}

const log = L.makeLogger('log.txt')

const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
})

browser.setCookie(...JSON.parse(fs.readFileSync('./data/cookies.txt').toString()))
const page = await browser.newPage()
await page.setViewport({
  width: 1920,
  height: 1030,
  deviceScaleFactor: 1,
});
await page.setBypassCSP(true)
page.setDefaultTimeout(60 * 1000)

const url = new URL('https://www.linkedin.com/jobs/search')
url.searchParams.set('geoId', config.geoId)
url.searchParams.set('keywords', config.keywords)
await page.goto(url.toString())
// networkidle 2 never happens 🤡
await new Promise<void>(s => setTimeout(s, 10000))

for(let i = 0; i < 50; i++) {
    log.I('Scraping page ', [i])

    const data = await page.evaluate(async() => {
        console.log('starting')
        await waitUntilAppears(document, '.job-card-container', false)

        const errors: string[] = []
        const jobs: Job[] = []

        const cardContainers = [...document.querySelector('ul:has(li.jobs-search-results__job-card-search--generic-occludable-area), ul:has(> li .job-card-container)')!.children]

        console.log('found', cardContainers.length, 'cards')
        for(let i = 0; i < cardContainers.length; i++) {
            console.log('doing card', i)
            try {
                const container = cardContainers[i]
                const changed = waitForChange('.jobs-search__job-details')

                container.scrollIntoView({ behavior: 'instant' })
                const card = await waitUntilAppears(container, '.job-card-container', false)
                ;(card as HTMLElement).click()

                await changed
                await new Promise<void>(s => setTimeout(s, 2000))
                // avoid rate limiting, and also give time for things to load
                // no idea if these work
                await waitUntilAppears(document, '.jobs-description--reformatted', true)
                await waitUntilAppears(document, '.job-details-jobs-unified-top-card__company-name', true)
                await waitUntilAppears(document, '.job-details-fit-level-preferences', false)

                const jobId = card.getAttribute('data-job-id') ?? null

                const description = getTextLines(document.querySelector('.jobs-description--reformatted')!)
                const preferences = [...document.querySelectorAll('.job-details-fit-level-preferences > *')].map(it => it.textContent?.trim()).filter(it => it !== undefined)

                const title = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim() ?? null
                const company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim() ?? null

                jobs.push({ jobId, description, preferences, title, company })
            }
            catch(err) {
                console.error(err)
                errors.push('card ' + i + ' ' + err)
            }
        }

        return { errors, jobs }

        function getTextLines(el: HTMLElement) {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const parts = [];
            let node;
            while (node = walker.nextNode()) {
                parts.push((node.nodeValue ?? '').trim());
            }
            return parts.filter(Boolean).join('\n').trim();
        }

        async function waitUntilAppears(
            root: Document | Element,
            selector: string,
            nonEmpty: boolean
        ) {
            const el = root.querySelector(selector)
            if(el) return el

            return await new Promise<Element>(s => {
                const observer = new MutationObserver(() => {
                    const el = root.querySelector(selector);
                    if (!el) return
                    if(nonEmpty && (el.textContent?.trim() ?? '') === '') return

                    s(el);
                    observer.disconnect()
                });

                observer.observe(root, {
                    childList: true,
                    subtree: true,
                    characterData: true,
                });
            })
        }

        function waitForChange(selector: string) {
            return new Promise<void>(s => {
                let lastHTML: string | undefined = document.querySelector(selector)?.innerHTML ?? undefined
                const observer = new MutationObserver(() => {
                    const el = document.querySelector(selector);
                    if (!el) return;

                    const html = el.innerHTML;
                    if (html !== lastHTML) {
                        console.log('  changed')
                        s();
                        observer.disconnect()
                    }
                    else {
                        console.log('  unchanged')
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    characterData: true,
                });
            })
        }
    })
    log.I('Done scraping')

    for(const error of data.errors) {
        log.E('During scraping: ', error)
    }

    const jobsPath = './data/jobs.json'

    const existingJobs: Record<string, Job> = await fsp.readFile(jobsPath)
        .then(buf => JSON.parse(buf.toString()))
        .catch(err => {
            log.E('While parsing: ', err)
            return {}
        })

    for(const newJob of data.jobs) {
        if(newJob.jobId === null) {
            log.W('Job id is null for ', [newJob])
            newJob.jobId = 'null'
        }

        const existing = existingJobs[newJob.jobId]
        if(existing) {
            if(
                existing.title === newJob.title
                    && existing.company === newJob.company
                    && new Set(existing.preferences)
                        .symmetricDifference(new Set(newJob.preferences)).size === 0
                    && existing.description === newJob.description
            ) {
                ;
            }
            else {
                log.I(
                    'Found different jobs at ',
                    [newJob.jobId],
                    [
                        ['\nNew: ', [newJob], '\nOld: ', [existing]],
                        'extra-details',
                    ],
                )
                newJob.previous = existing
            }
        }

        existingJobs[newJob.jobId] = newJob
    }

    await fsp.writeFile(jobsPath, JSON.stringify(existingJobs))

    await page.evaluate(() => {
        ;(document.querySelector('.jobs-search-pagination__button--next')! as HTMLElement).click()
    })

    await new Promise<void>(s => setTimeout(s, 2000))
}

log.I('Done')
await browser.close()
