import fs from 'node:fs'
import * as L from './lib/log.ts'
import * as U from './lib/util.ts'

const log = L.makeLogger('log.txt')

type Data = {
    name: string
    count: number
}
const pointCount = new Map<string, Data>()

const responses: Record<string, any> = JSON.parse(fs.readFileSync('./data/resumeCategoryResponses.json').toString())

for(const response of Object.values(responses)) {
    const content: string = response.choices[0].message.content
    const array = (() => {
        try {
            let arr = U.toArray(content, log)
            if(arr !== undefined) return arr
        }
        catch(err) {}

        return content
            .split('\n')
            .filter(it => it)
            .map(it => it.replace(/^\*\*/, '').replace(/\*\*$/, '').trim())
            .filter(it => it.startsWith('-'))
            .map(it => it.replace(/^-/, '').trim())
    })()
    const map = new Map(array.map(it => [U.toId(it), it]))
    for(const [id, name] of map) {
        const data = pointCount.get(id) ?? { name, count: 0 }
        data.count++
        pointCount.set(id, data)
    }
}

const result = [...pointCount]
    .sort((a, b) => -(a[1].count - b[1].count))
    .filter(it => it[1].count > 1)
    .map(it => `${it[1].name} - ${it[1].count}`)
    .join('\n')

fs.writeFileSync('./data/resumeCounts.txt', result)
