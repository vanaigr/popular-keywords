import fs from 'node:fs'
import type { Job } from './getDescriptions.ts'

const result: Record<string, unknown> = {}

const jobs: Record<string, Job> = JSON.parse(fs.readFileSync('./data/jobs.json').toString())
const jobsArray = Object.values(jobs)
let jobsI = 0
const responses: unknown[] = JSON.parse(fs.readFileSync('./data/extract-responses.json').toString())
// last response crashed, first few are tests
for(let responseI = 0; responseI < responses.length - 1; responseI++) {
    const response = responses[responseI]
    if(typeof response === 'string') {
        continue
    }
    const job = jobsArray[jobsI++]

    result['' + job.jobId] = response
}

fs.writeFileSync('./data/jobCategoryResponses.json', JSON.stringify(result, null, 2))
