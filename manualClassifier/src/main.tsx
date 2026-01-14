import R, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import data from './data.json'

type Counts = Map<string, number>

function toId(name: string) {
    return name
        .toLowerCase()
        .replace(/ *\d*$/, '')
        .replaceAll(/[^a-z0-9#+]/g, '')
        .replace(/\js$/, '')
}

const App = () => {
    const items = Object.values(data);
    const [currentIndex, setCurrentIndex0] = useState(() => parseInt(localStorage.getItem('pageIndex') || '0'));
    const setCurrentIndex = (newIndex: number) => {
        localStorage.setItem('pageIndex', '' + newIndex)
        setCurrentIndex0(newIndex)
    }

    const getCounts = () => {
        const counts: Counts = new Map()
        for(const item of items) {
            const words = (() => {
                const storageKey = `page-${item.jobId}`;
                try {
                    const storedData = localStorage.getItem(storageKey);
                    if(storedData !== null) return new Set<string>(JSON.parse(storedData))
                } catch(err) {
                }
                return new Set<string>()
            })()

            for(const word of words) {
                counts.set(word, (counts.get(word) ?? 0) + 1)
            }
        }

        return counts
    }

    {
        const names = new Map<string, string>()
        const counts: Counts = new Map()
        for(const item of items) {
            const words = (() => {
                const storageKey = `page-${item.jobId}`;
                try {
                    const storedData = localStorage.getItem(storageKey);
                    if(storedData !== null) return new Set<string>(JSON.parse(storedData))
                } catch(err) {
                }
                return new Set<string>()
            })()

            const ids = new Set<string>()
            for(const word of words) {
                ids.add(toId(word))
                if(!names.has(toId(word))) names.set(toId(word), word)
            }

            for(const word of ids) {
                counts.set(word, (counts.get(word) ?? 0) + 1)
            }
        }

        const obj: any[] = []
        for(const [id, count] of counts) {
            obj.push([names.get(id), count])
        }
        obj.sort((a, b) => -(a[1] - b[1]))
        console.log(obj.map(it => `${it[0]}\t${it[1]}`).join('\n'))
    }

    const [wordCounts, setWordCounts] = useState(() => getCounts())

    return <Page
        wordCounts={wordCounts}
        key={currentIndex}
        item={items[currentIndex]}
        index={currentIndex}
        count={items.length}
        toPrev={currentIndex === 0 ? undefined : () => setCurrentIndex(currentIndex - 1)}
        toNext={currentIndex >= items.length - 1 ? undefined : () => setCurrentIndex(currentIndex + 1)}
        updateCounts={() => {
            setWordCounts(getCounts())
        }}
    />
}

type Job = {
    jobId: string
    description: string
    title: string
}

function escapeRegex(str: string) {
    return str.split('').map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('')
}

function Page({ wordCounts, item, toPrev, toNext, index, count, updateCounts }: {
    wordCounts: Counts
    item: Job
    index: number
    count: number
    toPrev: (() => void) | undefined;
    toNext: (() => void) | undefined;
    updateCounts: () => void
}) {
    const storageKey = `page-${item.jobId}`;

    const [tags, setTags] = useState<Set<string>>(() => {
        try {
            const storedData = localStorage.getItem(storageKey);
            if(storedData !== null) return new Set(JSON.parse(storedData))
        } catch(err) {
        }
        return new Set()
    });
    const ref = R.useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if(e.target) {
                const target = e.target as any
                const tag = target.tagName.toLowerCase();
                const isEditable =
                    tag === 'input' ||
                        tag === 'textarea' ||
                        target.isContentEditable;
                if(isEditable) return
            }

            if (e.code === 'Space') {
                    e.preventDefault();

                const selection = window.getSelection();
                let selectedText = (selection ?? '').toString().trim();
                selectedText = selectedText.replace(/[,.]+$/, '')
                selectedText = selectedText.replace(/^[,]+/, '')

                if (selectedText) {
                    setTags(prev => {
                        const nextTags = new Set(prev)
                        nextTags.add(selectedText)
                        localStorage.setItem(storageKey, JSON.stringify([...nextTags]));
                        updateCounts()
                        return nextTags
                    });
                }
            } else if (e.code === 'KeyH' && toPrev) {
                e.preventDefault();
                toPrev();
            } else if (e.code === 'KeyL' && toNext) {
                e.preventDefault();
                toNext();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [toPrev, toNext]);

    const text = item.description

    const ranges: [number, number, 'keyword' | 'keyword-missing' | 'special', string][] = []
    for(const [wordOrig, _] of wordCounts) {
        const word = new RegExp('\\b' + escapeRegex(wordOrig), 'gi')
        for (const match of text.matchAll(word)) {
            ranges.push([
                match.index,
                match.index + match[0].length,
                tags.has(wordOrig) ? 'keyword' : 'keyword-missing',
                wordOrig,
            ])
        }
    }

    for(const word of [
        /job description\n/gi,
        /responsibilities\n/gi,
        /must have\n/gi,
        /nice to have\n/gi,
        /benefits\n/gi,
        /about the role\n/gi,
        /this role\n/gi,
        /role description\n/gi,
        /job responsibilities\n/gi,
        /job requirements\n/gi,
        /what we’re looking for\n/gi,
        /job location\n/gi,
    ]) {
        for (const match of text.matchAll(word)) {
            ranges.push([match.index, match.index + match[0].length, 'special', ''])
        }
    }

    ranges.sort((a, b) => a[0] - b[0])
    for(let i = 1; i < ranges.length;) {
        const range = ranges[i]
        if(range[0] < ranges[i - 1][1]) {
            ranges[i - 1][1] = Math.max(ranges[i - 1][1], range[1])
            ranges.splice(i, 1)
        }
        else {
            i++
        }
    }

    const parts: R.ReactNode[] = []
    let prev = 0
    for(const range of ranges) {
        parts.push(<R.Fragment key={prev}>{item.description.substring(prev, range[0])}</R.Fragment>)
        parts.push(
            <span key={range[0]} style={
                range[2] === 'special'
                    ? { fontSize: '20px', fontWeight: 'bold' }
                    : { backgroundColor: range[2] === 'keyword' ? 'yellow' : 'red' }
            }
                onClick={range[2] === 'keyword-missing' ? () => {
                    setTags(prev => {
                        const nextTags = new Set(prev)
                        nextTags.add(range[3])
                        localStorage.setItem(storageKey, JSON.stringify([...nextTags]));
                        updateCounts()
                        return nextTags
                    });

                } : undefined}
            >
                {item.description.substring(range[0], range[1])}
            </span>
        )
        prev = range[1]
    }
    parts.push(<R.Fragment key={prev}>{item.description.substring(prev)}</R.Fragment>)


    return (
        <div
            style={{
                flex: '1 1 0',
                padding: '20px',
                fontFamily: 'Arial, sans-serif',
                display: 'flex',
                gap: '10px',
            }}
        >
            <div style={{
                flex: '1 1 0',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #ccc',
                borderRadius: '5px',
                backgroundColor: '#f9f9f9'
            }}>
                <div style={{
                    padding: '20px',
                    paddingBottom: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                }}>
                    <h2 style={{ margin: 0, padding: 0 }}>{item.title}</h2>
                    <div style={{
                        fontSize: '14px',
                        color: '#666'
                    }}>
                        Item {index} of {count}
                    </div>
                </div>
                <div style={{
                    paddingTop: 0,
                    padding: '20px',
                    flex: '1 1 0',
                    overflowY: 'scroll',
                    fontSize: '16px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-line',
                }}>
                    {parts}
                </div>
            </div>

            <div style={{
                display: 'flex',
                gap: '5px',
                flexDirection: 'column',
                width: '300px',
            }}>
                <div style={{
                    display: 'flex',
                    gap: '10px',
                }}>
                    <button
                        onClick={toPrev}
                        disabled={toPrev === undefined}
                        style={{
                            flex: '1 1 0',
                            padding: '10px 20px',
                            cursor: toPrev === undefined ? 'not-allowed' : 'pointer',
                            opacity: toPrev === undefined ? 0.5 : 1
                        }}
                    >
                        Previous
                    </button>
                    <button
                        onClick={toNext}
                        disabled={toNext === undefined}
                        style={{
                            flex: '1 1 0',
                            padding: '10px 20px',
                            cursor: toNext === undefined ? 'not-allowed' : 'pointer',
                            opacity: toNext === undefined ? 0.5 : 1
                        }}
                    >
                        Next
                    </button>
                </div>

                <div style={{
                    flex: '1 1 0',
                    overflowY: 'scroll',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    backgroundColor: '#f9f9f9',
                }}>
                    {[...tags].map((tag: string, index: number) => (
                        <span key={index} style={{
                            borderRadius: '4px',
                            fontSize: '14px',
                            display: 'flex',
                            gap: '5px',
                            alignItems: 'stretch',
                        }}>
                            <button style={{ padding: '0px 6px' }} onClick={() => {
                                setTags(prev => {
                                    const nextTags = new Set(prev)
                                    nextTags.delete(tag)
                                    localStorage.setItem(storageKey, JSON.stringify([...nextTags]));
                                    updateCounts()
                                    return nextTags
                                });

                            }}>
                                x
                            </button>
                            <div style={{ padding: '6px 8px' }}>
                                {tag}
                            </div>
                        </span>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '5px' }}>
                    <input
                        onKeyDown={e => {
                            if(e.code === 'Enter') {
                                setTags(prev => {
                                    const selectedText = ref.current!.value.trim()
                                    const nextTags = new Set(prev)
                                    nextTags.add(selectedText)
                                    localStorage.setItem(storageKey, JSON.stringify([...nextTags]));
                                    updateCounts()
                                    ref.current!.value = ''
                                    return nextTags
                                })
                            }
                        }}
                        style={{ flex: '1 1 0' }}
                        type='text'
                        ref={ref}
                    />
                    <button
                        onClick={() => {
                            setTags(prev => {
                                const selectedText = ref.current!.value.trim()
                                const nextTags = new Set(prev)
                                nextTags.add(selectedText)
                                localStorage.setItem(storageKey, JSON.stringify([...nextTags]));
                                updateCounts()
                                ref.current!.value = ''
                                return nextTags
                            })
                        }}
                    >
                        Add
                    </button>
                </div>
            </div>

        </div>
    );
};

createRoot(document.getElementById('root')!).render(<App/>)
