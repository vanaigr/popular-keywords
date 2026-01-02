import puppeteer1 from 'puppeteer'
import puppeteer2 from 'puppeteer-extra'
import stealth from 'puppeteer-extra-plugin-stealth'

const puppeteer = puppeteer2 as any as typeof puppeteer1
;(puppeteer as any).use(stealth())

export default puppeteer
