# Tech Trends Scraper

Discovers popular technologies by analyzing job postings and resumes.

## How it works

1. Scrapes LinkedIn for job postings
2. Scrapes PostJobFree for resumes
3. Uses LLM (via OpenRouter) to extract technology keywords
4. Aggregates results to identify trending technologies

All data is saved in `./data/` directory, with each pipeline step in its own file.

## Setup

Create a `config.ts` file with:

```typescript
export default {
    geoId: 'your-linkedin-geo-id',
    keywords: 'search terms',
    apiKey: 'sk-or-v1-...'  // OpenRouter API key
}
```

Install deps:

```
pnpm i
```

Install puppeteer:

```
pnpm exec puppeteer browsers install chrome
```

## Usage

### Login to LinkedIn and save session

Opens browser, saves cookies to ./data/cookies.txt

```bash
node src/login.ts
```

### Scrape job postings

Scrapes LinkedIn jobs, saves to ./data/jobs.json

```bash
node src/getDescriptions.ts
```

### Collect resume links

Scrapes PostJobFree links, saves to ./data/resumeLinks.json

```bash
node src/getResumeLinks.ts
```

### Download full resumes

Fetches resume content, saves to ./data/resumes.json

```bash
node src/getResumes.ts
```

### Extract job keywords

LLM extracts tech keywords, saves to ./data/jobCategoryResponses.json

```bash
node src/classifyJobs.ts
```

### Extract resume keywords

LLM extracts tech keywords, saves to ./data/resumeCategoryResponses.json

```bash
node src/classifyResumes.ts
```

### Generate job frequency graph

Creates graph (./data/grahp.gexf) and sorted list (./data/list.txt)

```bash
node src/toFrequency.ts
```

### Generate resume frequency list

Creates sorted list for resumes (./data/resumeCounts.txt)

```bash
node src/resumesToFrequency.ts
```

### Alternative: Manual classification UI

Web app for manually reviewing and tagging job descriptions. Uses browser localStorage to save progress.

```bash
cd manualClassifier
pnpm i
pnpm dev
```

Navigate pages with Previous/Next or H/L keys. Select text and press Space to tag, or type keywords and click Add.

Keywords are saved per page in `localStorage`, extract them by adding `console.log()` to react component to print the aggregated counts :)

## Stack

- Puppeteer for web scraping
- OpenRouter
- TypeScript
- Node.js

