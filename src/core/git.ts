/**
 * For getDiff and parse, all credits are to https://github.com/unjs/changelogen/blob/main/src/git.ts#L58
 * I only desconstructed to what I needed.
 */

import { execa, execaSync } from "execa"
import { valid } from "semver"

type GitCommitAuthor = {
    name: string
    email: string
}

type RawGitCommit = {
    message: string
    shortHash: string
    author: GitCommitAuthor
    body: string
}

export type GitCommit = RawGitCommit & {
    description: string
    type: string
    scope: string
    authors: GitCommitAuthor[]
    isBreaking: boolean
}

const ConventionalCommitRegex =
    /(?<type>[a-zA-Z]+)(\((?<scope>.+)\))?(?<breaking>!)?: (?<description>.+)/i
const CoAuthoredByRegex = /co-authored-by:\s*(?<name>.+)(<(?<email>.+)>)/gim

const parseGitCommit = (commit: RawGitCommit): GitCommit | null => {
    const match = commit.message.match(ConventionalCommitRegex)
    if (!match?.groups) return null

    const type = match.groups.type ?? ""

    const scope = match.groups.scope ?? ""
    const isBreaking = Boolean(match.groups.breaking)
    const description = match.groups.description ?? ""

    const authors: GitCommitAuthor[] = [commit.author]
    for (const match of commit.body.matchAll(CoAuthoredByRegex)) {
        if (match.groups)
            authors.push({
                name: (match.groups.name || "").trim(),
                email: (match.groups.email || "").trim(),
            })
    }

    return {
        ...commit,
        authors,
        description,
        type,
        scope,
        isBreaking,
    }
}

export const parseCommits = (commits: RawGitCommit[]): GitCommit[] => {
    return commits
        .map((commit) => parseGitCommit(commit))
        .filter((v) => v !== null)
}

// git for-each-ref --format='%(refname:short) %(objectname)' --sort=-taggerdate --count=1 refs/tags
// e.g: v0.0.0 sha...
export const getLastTag = async () => {
    const { stdout } = await execa("git", [
        "for-each-ref",
        "--format=%(refname:short) %(objectname)",
        "--sort=-taggerdate",
        "--count=1",
        "refs/tags",
    ])

    const [tag, sha] = stdout.split(" ")

    if (!tag || !sha) return undefined

    return [tag, sha] as const
}

// git for-each-ref --sort=-creatordate --format '%(refname:short)' refs/tags
// e.g: v0.0.1\nv0.0.0
export const getNthTag = async (n: number) => {
    const { stdout: tagListString } = await execa("git", [
        "for-each-ref",
        "--sort=-taggerdate",
        "--format=%(refname:short)",
        "refs/tags",
    ])

    const tagList = tagListString.split("\n")
    const nthTagName = tagList[n]

    if (!nthTagName) throw new Error("getNthTag > No tag found")

    const tagSha = await execa`git rev-parse ${nthTagName}`

    return tagSha.stdout
}

export const getTagAmount = async () => {
    const { stdout: tagListString } = await execa("git", [
        "for-each-ref",
        "--sort=-taggerdate",
        "--format=%(refname:short)",
        "refs/tags",
    ])

    const tagList = tagListString.split("\n")

    return tagList.length
}

export const getGitDiff = async (
    from?: string,
    to = "HEAD",
): Promise<RawGitCommit[]> => {
    const range = `${from ? `${from}...` : ""}${to}`
    // https://git-scm.com/docs/pretty-formats
    const { stdout } =
        await execa`git --no-pager log ${range} --pretty=${"---%n%s|%h|%an|%ae%n%b"}`

    return stdout
        .split("---\n")
        .splice(1)
        .map((line) => {
            const [firstLine, ..._body] = line.split("\n")
            const [message, shortHash, authorName, authorEmail] =
                firstLine?.split("|") ?? ""

            const r: RawGitCommit = {
                message: message ?? "",
                shortHash: shortHash ?? "",
                author: { name: authorName ?? "", email: authorEmail ?? "" },
                body: _body.join("\n").trim(),
            }

            return r
        })
}

export const createReleaseTag = async (
    version: string,
    message: string,
    hash: string = "HEAD",
) => {
    const validVersion = valid(version)

    if (validVersion === null) throw new Error("Invalid tag semver version")

    return execa("git", ["tag", "-a", `v${validVersion}`, "-m", message, hash])
}

export const getOwnerSlashRepo = () => {
    try {
        const remoteUrl = execaSync("git", [
            "config",
            "--get",
            "remote.origin.url",
        ]).stdout.trim()
        const [, ownerSlashRepo] =
            remoteUrl.match(/github\.com[:/](.+?)(\.git)?$/) ?? []

        if (!ownerSlashRepo) throw new Error("Could not find remote origin url")

        return ownerSlashRepo
    } catch {
        throw new Error(
            "Could not find remote origin url in the current directory",
        )
    }
}

export const getInitialCommit = () => {
    try {
        const initialCommit = execaSync("git", [
            "rev-list",
            "--max-parents=0",
            "HEAD",
        ]).stdout.trim()

        return initialCommit
    } catch (error) {
        throw new Error("Could not find any commits in the current directory")
    }
}
