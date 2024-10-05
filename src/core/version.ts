import { execaSync } from "execa"
import { inc } from "semver"
import type { GitCommit } from "./git"

type VersionKey = "major" | "minor" | "patch"

export const figureOutNextVersion = (
    commits: GitCommit[],
    currentVersion: string,
) => {
    const versionKey = commits.reduce((acc, commit) => {
        const type = commit.type
        if (commit.isBreaking || acc === "major") return "major"
        if (type === "feat" || acc === "minor") return "minor"

        // We will consider chores as patches.
        return "patch"
    }, "patch" as VersionKey)

    const nextVersion = inc(currentVersion, versionKey)
    if (nextVersion === null)
        throw new Error(`Invalid version, got ${nextVersion}`)

    return {
        versionKey,
        versionValue: nextVersion,
    }
}

export const bumpPackages = ({
    versionKey,
    versionValue,
}: ReturnType<typeof figureOutNextVersion>) => {
    console.info(`Bumping packages to ${versionValue}`)

    execaSync`node node_modules/bumpp/bin/bumpp.js ${versionKey} -r -y --no-push --no-tag --all`
}
