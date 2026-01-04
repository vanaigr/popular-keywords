import fsp from 'node:fs/promises'
import util from 'node:util'
import { OpenRouter } from "@openrouter/sdk";
import type { Resume } from './getResumes.ts'
import * as U from './lib/util.ts'
import * as L from './lib/log.ts'
import config from '../config.ts'

const log = L.makeLogger('log.txt')

const resumes = Object.entries(JSON.parse((await fsp.readFile('./data/resumes.json')).toString()) as Record<string, Resume>)

const openRouter = new OpenRouter({ apiKey: config.apiKey });

const responsesPath = './data/resumeCategoryResponses.json'
const responses = await U.readJson<Record<string, unknown>>(responsesPath, {}, log)

for(let i = 0; i < resumes.length; i++) {
    const [resumeUrl, resume] = resumes[i]
    if(responses[resumeUrl] !== undefined) {
        continue
    }
    log.I('Processing resume ', [i], ' of ', [resumes.length], ' (', [resumeUrl], ')')

    const undedactedText = resume.text
        .replaceAll('\r\n', '\n')
        .replaceAll('\r', '\n')
        .trim()
        .replace(/contact this candidate$/i, '')
        .trim()

    const candidateStarts = [
        undedactedText.search(/(p *r *o *f *e *s *s *i *o *n *a *l *)?s *u *m *m *a *r *y/i),
        undedactedText.search(/(w *o *r *k *)?e *x *p *e *r *i *e *n *c *e/i),
        undedactedText.search(/a *b *o *u *t/i),
        undedactedText.search(/s *k *i *l *l *s/i),
    ]
    let startIndex = Math.min(Infinity, ...candidateStarts.filter(it => it !== -1))
    if(startIndex === Infinity) {
        log.E('Could not find the start of the resume')
        break
    }

    const lineStart = undedactedText.lastIndexOf('\n', startIndex - 1)
    if(lineStart !== -1) {
        const line = undedactedText.substring(lineStart, startIndex)
        const exclude = ['email', 'cell', 'phone', 'linkedin', 'website', '**']
        if(!exclude.some(it => line.toLowerCase().includes(it))) {
            startIndex = lineStart + 1
        }
    }

    const text = undedactedText.substring(startIndex).trim()

    // This is more of an artifact of the search since some "java stack developer" got matched
    if(!(/\b(javascript|typescript|js|ts|react|reactjs|next|nextjs|vue|node|nodejs)\b/i.test(text))) {
        log.W('Not a js developer. Skipping')
        continue
    }

    /*
    if(text.length > 20000) {
        log.W('Model will explode. Skipping')
        continue
    }
    */

    const response = await openRouter.chat.send({
        model: 'nvidia/nemotron-3-nano-30b-a3b:free',
        stream: false,
        /*
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
        */
        messages: [
            {
                role: 'user',
                content: makePrompt(text),
            },
        ],
    })

    responses['' + resumeUrl] = response
    await fsp.writeFile(responsesPath, JSON.stringify(responses, null, 2))
}

log.I('Done')

function makePrompt(desc: string) {
    return `
You are an assistant that extracts technical keywords from candidate resumes. Given a Resume, return a list of strings containing the relevant keywords, such as programming languages, frameworks, libraries, tools, platforms, cloud services, databases, methodologies.

**Extraction algorithm**

Start by writing a list of small sections, from which to extract keywords, e.g. each position of each job.
- Include sections like "Summary", "Professional Experience", "Work Experience", "Projects".
- Skip "Skills", "Interests", or similar sections that are only lists of skills with no contextual usage.

Then, go through the sections one by one, and produce a list of keywords, according to these rules:
- Include technologies. Examples: React, Next, C#, .NET, RDS.
- Include technology categories. Examples: Databases, ORM, API, REST, Microservices, CI/CD, Cloud.
- Ignore keywords that are not technologies or technology categories (e.g., MVP, rate limiting, authentication, roadmap, leadership, performance).

Finally, produce the output list by concatenating keywords from each section, with section names above each sub-list. Duplicates are fine. Example:
# Full stack developer
- Python
- React
- CI/CD
# SE Intern, Google
- React
- Next.js
# Bullet 1
- AWS


Resume:
"""
${desc}
"""
`.trim()
}

/*
- If a generic technology and specific components are both mentioned, include both. Example: "AWS (ECS Fargate, RDS, S3, ALB)" -> "AWS", "AWS ECS Fargate", "AWS RDS", "AWS S3", "AWS ALB".
- If only the specific component is mentioned, use its full name. Example: "ECS Fargate, S3" -> "AWS ECS Fargate", "AWS S3"
*/
