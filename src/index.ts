import { getInput, info, setFailed, setOutput } from "@actions/core"
import { exec } from "@actions/exec"
import { context } from "@actions/github"
import release from "./core/release"

const run = async () => {
    try {
        info("Release action started...")

        const githubToken = getInput("github-token")

        await exec("git", [
            "config",
            "--global",
            "user.email",
            '"github-actions[bot]@users.noreply.github.com"',
        ])
        await exec("git", [
            "config",
            "--global",
            "user.name",
            '"github-actions[bot]"',
        ])

        await exec("git", [
            "remote",
            "set-url",
            "origin",
            `https://x-access-token:${githubToken}@github.com/${context.repo.owner}/${context.repo.repo}.git`,
        ])

        const newRelease = await release()

        if (newRelease) {
            setOutput("release", newRelease)
            info("New release created!")

            await exec("git", ["push", "--follow-tags"])

            info("New release pushed!")
        } else {
            info("No new release created!")
        }
    } catch (error) {
        setFailed(
            error instanceof Error ? error.message : `Unknown error: ${error}`,
        )
    }
}

run()
