import { readFile, writeFile } from "fs/promises"
import { resolve } from "pathe"
import {
    getInitialCommit,
    getLastTag,
    getOwnerSlashRepo,
    type GitCommit,
} from "./git"

export const staticHeader =
    "Changelogs are auto generated from commits using `harmonic-major` action."

export const changelogParseRegex = /\s(?=## \[(?:\d{1,3}.){3})/u

export const parseChangelog = (changelog: string) => {
    if (changelog === "") return []

    const [, rest] = changelog.split(`${staticHeader}\n\n`)

    if (!rest) throw new Error("parseChangelog > No changelog found")

    return rest.trim().split(changelogParseRegex)
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

const changelogsWithoutHeader = (changelog: string[]) => {
    const [, ...rest] = changelog
    return rest
}

export const makeDiffLink = (
    ownerSlashRepo: string,
    baseHash: string,
    compareHash: string,
) => `https://github.com/${ownerSlashRepo}/compare/${baseHash}...${compareHash}`

export const generateChangelog = (
    currentChangelog: string[],
    newChangelog: GenerateChangelogConfig,
    lastTagSha?: string,
) => {
    const releases = currentChangelog[0]?.startsWith("## ")
        ? currentChangelog
        : changelogsWithoutHeader(currentChangelog)

    let newRelease = ""

    const ownerSlashRepo = getOwnerSlashRepo()
    const firstCommit = getInitialCommit()

    // HEAD will be replaced with the bumped tag sha
    const newTagHeading = `[${newChangelog.tag}](${makeDiffLink(ownerSlashRepo, lastTagSha ?? firstCommit, "HEAD")}) (${newChangelog.date})`
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

    return {
        header: withLineBreak(staticHeader),
        newRelease,
        releases,
    }
}

export const assembleChangelog = async (
    {
        header,
        newRelease,
        releases,
    }: {
        header?: string
        newRelease: string
        releases: string[]
    },
    lastTag?: string,
) => {
    const [, newTag] =
        (await getLastTag().catch((err) => {
            console.error(
                new Error("assembleChangelog > getLastTag() error", {
                    cause: err,
                }),
            )
            return undefined
        })) ?? []

    if (!newTag || lastTag === newTag) {
        throw new Error("No new commits found")
    }

    const lastRelease = releases.shift()
    if (lastRelease !== undefined && lastTag !== undefined) {
        const updatedRelease = lastRelease.replace(/(?<=\.{3})HEAD/, lastTag)
        releases.unshift(updatedRelease)
    }

    const updatedNewRelease = newRelease.replace(/(?<=\.{3})HEAD/, newTag)

    return [header, updatedNewRelease, ...releases].join("\n")
}

export const readChangelog = async (changelogPath: string = "CHANGELOG.md") => {
    const rootDir = process.cwd()
    const changelogFile = await readFile(resolve(rootDir, changelogPath), {
        encoding: "utf8",
    }).catch(() => "")

    return changelogFile
}

export const writeChangelog = async (
    changelog: string,
    changelogPath: string = "CHANGELOG.md",
) => {
    const rootDir = process.cwd()
    await writeFile(resolve(rootDir, changelogPath), changelog, {
        encoding: "utf8",
    })
}
