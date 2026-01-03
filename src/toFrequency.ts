import fs from 'node:fs'
import * as L from './lib/log.ts'
import * as U from './lib/util.ts'

const log = L.makeLogger('log.txt')

const pointCount = new Map<string, number>()
const technologiesArray: string[][] = []

const responses: Record<string, any> = JSON.parse(fs.readFileSync('./data/jobCategoryResponses.json').toString())
for(const [jobId, response] of Object.entries(responses)) {
    const l = log.addedCtx([jobId])

    const content: string = response.choices[0].message.content
    const from = content.indexOf('[')
    const to = content.lastIndexOf(']')
    if(from === -1 || to === -1) {
        l.W('Skipping')
        continue
    }
    const technologies: string[] = JSON.parse(content.substring(from, to + 1))
    technologiesArray.push(technologies)

    for(const it of technologies) {
        const id = toId(it)
        pointCount.set(id, (pointCount.get(id) ?? 0) + 1)
    }
}

//const toInclude = new Set([...pointCount.entries()].sort((a, b) => -(a[1] - b[1])).slice(0, 100).map(it => it[0]))

const points = new Map<string, { name: string, frequency: number }>()
const edges = new Map<string, { a: string, b: string, weight: number }>()

for(const technologies of technologiesArray) {
    for(let firstI = 0; firstI < technologies.length; firstI++) {
        const first = technologies[firstI]
        const firstId = toId(first)
        //if(!toInclude.has(firstId)) continue

        const point = points.get(firstId) ?? { name: first, frequency: 0 }
        point.frequency++
        points.set(firstId, point)

        for(let secondI = firstI + 1; secondI < technologies.length; secondI++) {
            const second = technologies[secondI]
            const secondId = toId(second)
            //if(!toInclude.has(secondId)) continue

            const points = [firstId, secondId].sort()
            const hash = U.getHash(...points)
            const edge = edges.get(hash) ?? { a: points[0], b: points[1], weight: 0 }
            edge.weight++
            edges.set(hash, edge)
        }
    }
}

log.I('Graph has ', [points.size], ' points')


let result = `
<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.3" version="1.3">
    <graph mode="static" defaultedgetype="undirected">
`

result += `
<attributes class="node" mode="static">
    <attribute id="frequency" title="Frequency" type="float"/>
</attributes>
`

result += '<nodes>'
for(const [id, { name, frequency }] of points) {
//    result += `<node id="${encodeXmlNonAlnum(id)}" label="${encodeXmlNonAlnum(name)}"/>
//`

    result += `
<node id="${encodeXmlNonAlnum(id)}" label="${encodeXmlNonAlnum(name)}">
    <attvalues>
        <attvalue for="frequency" value="${encodeXmlNonAlnum('' + frequency)}"/>
    </attvalues>
</node>
`
}
result += '</nodes>'

result += '<edges>'
for(const [hash, edge] of edges) {
    result += `<edge
    id="${encodeXmlNonAlnum(hash)}"
    source="${encodeXmlNonAlnum(edge.a)}"
    target="${encodeXmlNonAlnum(edge.b)}"
    weight="${encodeXmlNonAlnum('' + edge.weight)}"
/>
`
}
result += '</edges>'

result += `
    </graph>
</gexf>
`

result = result.trim()

fs.writeFileSync('./data/grahp.gexf', result)

function encodeXmlNonAlnum(str: string) {
    return str.split('').map(c => {
        if (/[a-zA-Z0-9 ]/.test(c)) {
            return c;
        } else {
            return `&#${c.charCodeAt(0)};`;
        }
    }).join('');
}

function toId(name: string) {
    return name
        .toLowerCase()
        .replace(/ *\d*$/, '')
        .replaceAll(/[^a-z0-9#+]/g, '')
}
