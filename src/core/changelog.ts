import type { GitCommit } from "./git"

export const changelogParseRegex = /\s(?=## \[(?:\d{1,3}.){3})/u

export const parseChangelog = (changelog: string) => {
    return changelog.trim().split(changelogParseRegex)
}

type GenerateChangelogConfig = {
    date: string
    tag: string
    commits: GitCommit[]
}

const commitsTypeHeadings = {
    feat: "✨ Features",
    fix: "🐛 Fixes",
    chore: "🧹 Chores",
    test: "🧪 Tests",
}

const commitTypeMap = (v: string) => {
    switch (v) {
        case "feat":
            return "feat"
        case "fix":
            return "fix"
        case "test":
            return "test"
        default:
            return "chore"
    }
}

const makeLineBreaks = (n: number = 1) => "\n".repeat(n)
const withLineBreak = (v: string, n: number = 1) => `${v}${makeLineBreaks(n)}`
const makeH2 = (v: string) => `## ${v}`
const makeH3 = (v: string) => `### ${v}`
const makeImportant = (v: string) => `⚠️ ${v}`
const makeListItem = (v: string) => `-   ${v}`
const makeImportantListItem = (v: string) => makeListItem(makeImportant(v))
const orderByImportant = (a: GitCommit, b: GitCommit) =>
    +b.isBreaking - +a.isBreaking
const getCommitLineBreak = (i: number, length: number) => {
    const isLast = i === length - 1
    return isLast ? 2 : 1
}

export const generateChangelog = (
    currentChangelog: string[],
    newChangelog: GenerateChangelogConfig,
) => {
    const [header, ...releases] = currentChangelog

    let newRelease = ""

    const newTagHeading = `[${newChangelog.tag}](${"..."}) (${newChangelog.date})`
    newRelease += withLineBreak(makeH2(newTagHeading), 2)

    const groupedCommits: Record<
        ReturnType<typeof commitTypeMap>,
        GitCommit[]
    > = {
        feat: [],
        fix: [],
        chore: [],
        test: [],
    }

    // Grouping commits by type
    newChangelog.commits.forEach((commit) => {
        const commitType = commitTypeMap(commit.type)
        groupedCommits[commitType]?.push(commit)
    })

    if (Object.values(groupedCommits).every((v) => v.length === 0)) {
        throw new Error("No commits found")
    }

    const headings = {
        feat: withLineBreak(makeH3(commitsTypeHeadings.feat), 2),
        fix: withLineBreak(makeH3(commitsTypeHeadings.fix), 2),
        chore: withLineBreak(makeH3(commitsTypeHeadings.chore), 2),
        test: withLineBreak(makeH3(commitsTypeHeadings.test), 2),
    }

    const commitKeys = Object.keys(groupedCommits) as Array<
        ReturnType<typeof commitTypeMap>
    >
    commitKeys.forEach((k) => {
        const commits = groupedCommits[k]
        if (commits.length > 0) {
            newRelease += headings[k]
            commits.sort(orderByImportant).forEach((commit, i) => {
                const lineBreaks = getCommitLineBreak(i, commits.length)

                if (commit.isBreaking) {
                    newRelease += withLineBreak(
                        makeImportantListItem(commit.message),
                        lineBreaks,
                    )
                } else {
                    newRelease += withLineBreak(
                        makeListItem(commit.message),
                        lineBreaks,
                    )
                }
            })
        }
    })

    // Remove trailling line break
    newRelease = newRelease.slice(0, -1)

    return { header, newRelease, releases: [...releases] }
}

export const assembleChangelog = ({
    header,
    newRelease,
    releases,
}: {
    header?: string
    newRelease: string
    releases: string[]
}) => {
    return [header, newRelease, ...releases].join("\n")
}
