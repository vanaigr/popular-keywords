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
        if((responses[resumeUrl] as any).choices[0].message.content === '[]') {
            log.W('Unbailing resume')
        }
        else {
            continue
        }
    }
    log.I('Processing resume ', [i], ' of ', [resumes.length], ' (', [resumeUrl], ')')

    const undedactedText = resume.text
        .replaceAll('\r\n', '\n')
        .replaceAll('\r', '\n')
        .trim()
        .replace(/contact this candidate$/i, '')
        .trim()

    let startIndex = Infinity

    const index1 = undedactedText.search(/(p *r *o *f *e *s *s *i *o *n *a *l *)?s *u *m *m *a *r *y/i)
    if(index1 !== -1) startIndex = Math.min(startIndex, index1)
    const index2 = undedactedText.search(/(w *o *r *k *)?e *x *p *e *r *i *e *n *c *e/i)
    if(index2 !== -1) startIndex = Math.min(startIndex, index2)
    const index3 = undedactedText.search(/a *b *o *u *t/i)
    if(index3 !== -1) startIndex = Math.min(startIndex, index3)

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

    if(text.length > 20000) {
        log.W('Model will explode. Skipping')
        continue
    }

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

    try {
        const array = JSON.parse((response.choices[0].message.content as string).trim())
        if(array.length === 0) {
            log.W('Bailed out')
        }
        else {
            log.I('Found ', [array.length], ' technologies')
        }
    }
    catch(err) {
        log.E('Could not parse model output ', [err])
        break
    }
}

log.I('Done')

function makePrompt(desc: string) {
    const b = '`'

    return `
You are an assistant that extracts technical and professional keywords from candidate resumes. Given a resume, identify all relevant keywords such as programming languages, frameworks, tools, methodologies, platforms, and technologies.

Rules:
1. Ignore:
   - Generic words (e.g., "experience", "responsible", "team")
   - Terms that are not technologies or categories of technologies (e.g., "MVP", "rate limiting", "authentication")
   - Technical Skills section of the resume and similar sections, like Interests, that list the skills with no context

2. Include technology categories if they are used in the text, examples:
   - "Databases"
   - "ORM"
   - "API"
   - "REST"
   - "Microservices"
   - "CI/CD"
   - "Cloud"

3. Include both generic technologies and their specific parts if they are used in the text.
   - For example, if the text mentions ${b}AWS (ECS Fargate, RDS, S3, ALB)${b}, output should include:
     ["AWS", "AWS ECS Fargate", "AWS RDS", "AWS S3", "AWS ALB"]

4. Output must be a JSON array of strings, order is irrelevant. For example:
["Python", "React", "GCP", "Agile", "Docker"]

5. **Important**: Do not deduplicate names, just find terms, check against the rules above, and output as a list.

Job description:
"""
${desc}
"""
`.trim()
}

