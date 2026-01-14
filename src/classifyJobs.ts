import fsp from 'node:fs/promises'
import util from 'node:util'
import { OpenRouter } from "@openrouter/sdk";
import type { Job } from './getDescriptions.ts'
import * as U from './lib/util.ts'
import * as L from './lib/log.ts'
import config from '../config.ts'

const jobs = Object.values(JSON.parse((await fsp.readFile('./data/jobs.json')).toString()) as Record<string, Job>)

function makeSplitPrompt(description: string) {
    return `
The following is a job description. Output the same description, but include only the parts that describe what the candidate should be, should know, or will be working on.

**Important Rule** Do not alter or rearrange the content.

The text:
"""
${description}
"""
`.trim()
}

function extractSoftSkills(description: string) {
    return `
Extract soft skills mentioned in the job description.

Examples:
- "Truly cares and is passionate about the work they do" -> "Care", "Passion".
- "Self‑starter attitude and desire to create high‑quality, scalable software" -> "Self-starter".
- "Developing, testing, documenting, and supporting web and mobile applications" -> "Development", "Testing", "Documentation", "Support".

`.trim()
}

/*
function makePrompt(desc: string) {
    return `
Analyze the following job posting and extract keywords related to fitness criteria. Include:
- Technical skills (e.g., programming languages, software, tools). Examples: React, TypeScript, AWS
- Professional experience (e.g., domain expertise, specific project types). Examples: UI, Agile
- Behavioral qualities and soft skills (e.g., teamwork, punctuality, communication). Examples: Collaboration, Teamwork, English
- Educational or certification requirements. Examples: Bachelor's degree


Output should be a list of criteria. Example:
- React
- AWS
- Punctuality
- Collaboration
- English

Job description:

"""
${desc}
"""
`.trim()
}
*/

const log = L.makeLogger('log.txt')

const openRouter = new OpenRouter({ apiKey: config.apiKey });

const responsesPath = './data/jobRequirementResponses.json'
const responses = await U.readJson<Record<string, unknown>>(responsesPath, {}, log)

for(let i = 0; i < jobs.length; i++) {
    if(i < 3) continue
    const job = jobs[i]
    if(responses['' + job.jobId] !== undefined) continue
    log.I('Processing job ', [i], ' of ', [jobs.length], ' (id ', [job.jobId], ')')

    let newText = ''
    const text = job.description
    for(let i = 0; i < text.length; i++) {
        const c = text[i]
        if(c === '\n' && (text[i + 1] ?? '').toLowerCase() === text[i + 1]) {
            newText += ' '
        }
        else {
            newText += c
        }
    }

    /*
    const sentences: string[] = ['']
    const text = job.description
    for(let i = 0; i < text.length; i++) {
        const c = text[i]
        if(c === '.' && /\s/.test(text[i + 1] ?? '')) {
            sentences[sentences.length - 1] += c
            sentences.push('')
        }
        else if(c.toUpperCase() === c && text[i - 1] === '\n') {
            sentences.push('')
            sentences[sentences.length - 1] += c
        }
        else if(c === '\n' && (text[i + 1] ?? '').toLowerCase() === text[i + 1]) {
            sentences[sentences.length - 1] += ' '
        }
        else {
            sentences[sentences.length - 1] += c
        }
    }

    const sectionSize = 5

    const sections: string[] = []
    for(let i = 0; i < sentences.length; i += sectionSize) {
        let section = '# ' + (1 + sections.length) + '\n'

        for(let j = 0; j < sectionSize; j++) {
            const sentence = sentences[i + j]
            if(sentence) section += sentence
        }
        sections.push(section)
    }
    let newText = sections.join('\n').trim()
    */

    console.log(makeSplitPrompt(newText))
    break

    const response = await openRouter.chat.send({
        model: 'nvidia/nemotron-3-nano-30b-a3b:free',
        stream: false,
        responseFormat: {
            type: 'json_schema',
            jsonSchema: {
                name: 'root',
                strict: true,
                schema: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                },
            }
        },
        messages: [
            {
                role: 'user',
                content: makePrompt(job.description),
            },
        ],
    })

    responses['' + job.jobId] = response
    await fsp.writeFile(responsesPath, JSON.stringify(responses))
}

log.I('Done')
