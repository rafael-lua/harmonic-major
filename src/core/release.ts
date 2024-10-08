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

    const [lastTagVersion, lastTagSha] = lastTag ?? ["v0.0.0", undefined]

    const diff = await getGitDiff(lastTagSha).catch((err) => {
        console.error(new Error("getGitDiff() error", { cause: err }))
        return undefined
    })

    if (!diff || diff.length === 0) {
        console.info("No diff found, skipping release")
        return undefined
    }

    const commits = parseCommits(diff)

    const { versionKey, versionValue } = figureOutNextVersion(
        commits,
        lastTagVersion,
    )

    const changelogFile = await readChangelog()
    const currentChangelog = parseChangelog(changelogFile)
    const newTag = `v${versionValue}`

    const changelogs = generateChangelog(
        currentChangelog,
        {
            commits,
            date: now.toFormat("yyyy.M.d"),
            tag: newTag,
        },
        lastTagVersion,
    )

    await bumpPackages({ versionKey, versionValue })

    const changelog = await assembleChangelog(changelogs)

    await writeChangelog(changelog, undefined, versionValue).catch((err) => {
        console.error(new Error("writeChangelog() error", { cause: err }))
        return undefined
    })

    await createReleaseTag(versionValue, changelogs.newRelease).catch((err) => {
        console.error(new Error("createReleaseTag() error", { cause: err }))
        return undefined
    })

    return newTag
}

export default release
