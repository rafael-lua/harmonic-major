/**
 * For getDiff and parse, all credits are to https://github.com/unjs/changelogen/blob/main/src/git.ts#L58
 * I only desconstructed to what I needed.
 */

import { execa } from "execa"
import semver from "semver"

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

export const createReleaseTag = (
    version: string,
    message: string,
    hash: string = "HEAD",
) => {
    const validVersion = semver.valid(version)

    if (validVersion === null) throw new Error("Invalid tag semver version")

    return execa("git", ["tag", "-a", `v${validVersion}`, "-m", message, hash])
}