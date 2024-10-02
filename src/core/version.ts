import { execaSync } from "execa"
import type { GitCommit } from "./git"

type VersionKey = "major" | "minor" | "patch"

export const bumpPackages = (commits: GitCommit[]) => {
    const versionKey = commits.reduce((acc, commit) => {
        const type = commit.type
        if (commit.isBreaking || acc === "major") return "major"
        if (type === "feat" || acc === "minor") return "minor"

        // We weill consider chores as patches.
        return "patch"
    }, "patch" as VersionKey)

    execaSync`node node_modules/bumpp/bin/bumpp.js ${versionKey} -r -y --no-push --no-tag --all`
}
