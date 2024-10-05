import { DateTime } from "luxon"
import {
    assembleChangelog,
    generateChangelog,
    parseChangelog,
    readChangelog,
    writeChangelog,
} from "./changelog"
import { createReleaseTag, getGitDiff, getLastTag, parseCommits } from "./git"
import { bumpPackages, figureOutNextVersion } from "./version"

const now = DateTime.now()

const release = async () => {
    const lastTag = await getLastTag().catch((err) => {
        console.error(new Error("getLastTag() error", { cause: err }))
        return undefined
    })

    if (!lastTag)
        console.info("No recent tag found, will consider from the beginning")

    const [lastTagVersion, lastTagSha] = lastTag ?? ["0.0.0", undefined]

    const diff = await getGitDiff(lastTagSha).catch((err) => {
        console.error(new Error("getGitDiff() error", { cause: err }))
        return undefined
    })

    if (!diff || diff.length === 0) {
        console.info("No diff found, skipping release")
        return
    }

    const commits = parseCommits(diff)

    const { versionKey, versionValue } = figureOutNextVersion(
        commits,
        lastTagVersion,
    )

    const changelogFile = await readChangelog()
    const currentChangelog = parseChangelog(changelogFile)

    const changelogs = generateChangelog(
        currentChangelog,
        {
            commits,
            date: now.toFormat("yyyy.M.d"),
            tag: `v${versionValue}`,
        },
        lastTagSha,
    )

    bumpPackages({ versionKey, versionValue })

    await createReleaseTag(versionValue, changelogs.newRelease).catch((err) => {
        console.error(new Error("createReleaseTag() error", { cause: err }))
        return undefined
    })

    const changelog = await assembleChangelog(changelogs, lastTagSha)

    await writeChangelog(changelog).catch((err) => {
        console.error(new Error("writeChangelog() error", { cause: err }))
        return undefined
    })

    console.info("Release complete")
}

export default release
