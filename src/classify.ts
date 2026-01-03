import fsp from 'node:fs/promises'
import util from 'node:util'
import { OpenRouter } from "@openrouter/sdk";
import type { Job } from './getDescriptions.ts'
import * as U from './lib/util.ts'
import * as L from './lib/log.ts'
import config from '../config.ts'

const jobs = Object.values(JSON.parse((await fsp.readFile('./data/jobs.json')).toString()) as Record<string, Job>)

function makePrompt(desc: string) {
    return `
You are an assistant that extracts technical and professional keywords from job descriptions. Given a job description, identify all relevant keywords such as programming languages, frameworks, tools, methodologies, platforms, and technologies.

Rules:
1. Ignore:
   - Generic words (e.g., "experience", "responsible", "team")
   - Non-technical terms (e.g., "MVP", "leadership", "communication", "passion")

2. Include relevant higher-level or generic technical categories, such as:
   - "Databases"
   - "ORM"
   - "API"
   - "REST API"
   - "Microservices"
   - "CI/CD"
   - "Cloud"

3. Include both base technologies and their specific subtechnologies.
   - For example, if the text mentions ${'`'}AWS (ECS Fargate, RDS, S3, ALB)${'`'}, output should include:
     ["AWS", "AWS ECS Fargate", "AWS RDS", "AWS S3", "AWS ALB"]

4. Output must be a JSON array of strings. For example:
["Python", "React", "GCP", "Agile", "Docker"]

Job description:
"""
${desc}
"""
`.trim()
}

const log = L.makeLogger('log.txt')

const openRouter = new OpenRouter({ apiKey: config.apiKey });

const technologyCounts: Partial<Record<string, number>> = {}

for(let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    log.I('Processing job ', [i], ' (id ', [job.jobId], ')')

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

    const responsesPath = './data/extract-responses.json'
    const responses = await U.readJson<unknown[]>(responsesPath, [], log)
    responses.push(response)
    await fsp.writeFile(responsesPath, JSON.stringify(responses))

    const content = response.choices[0].message.content as string
    if(typeof content !== 'string') {
        log.E('Unexpected output')
        break
    }

    const from = content.indexOf('[')
    const to = content.lastIndexOf(']')
    if(from === -1 || to === -1) {
        log.E('Incorrect format')
        break
    }
    const technologies = JSON.parse(content.substring(from, to + 1))

    for(const technology of technologies) {
        technologyCounts[technology] = (technologyCounts[technology] ?? 0) + 1
    }
    log.I('Added ', [technologies.length], ' technologies')

    await fsp.writeFile('./data/technologies.json', JSON.stringify(technologyCounts))
}

log.I('Done')
