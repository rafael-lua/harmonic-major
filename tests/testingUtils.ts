import { execa, execaSync, parseCommandString } from "execa"
import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import { join } from "pathe"
import { getLastTag } from "../src/core/git"

export const setupTempGitRepository = async (
    fn?: (tempDir: string) => void | Promise<void>,
) => {
    const tempDir = mkdtempSync(join(tmpdir(), "git-test-"))
    process.chdir(tempDir)

    execaSync`git init`
    execaSync`git config user.email ${"test@example.com"}`
    execaSync`git config user.name ${"Test User"}`
    execaSync`git remote add origin ${"https://github.com/testowner/testrepo.git"}`
    execaSync`git branch -m main`

    if (fn) await fn(tempDir)

    return tempDir
}

export const runCmd = async (v: string) => {
    const { stdout } = await execa`${parseCommandString(v)}`
    console.log(stdout)
    return stdout
}

const currentWorkingDirectory = process.cwd()

export const defaultRepositoryCommands = (tempDir: string) => {
    const { stdout } =
        execaSync`ls -a ${currentWorkingDirectory + "/tests/fixtures/monorepo"}`

    stdout
        .split("\n")
        .filter((p) => p !== "." && p !== "..")
        .forEach((path) => {
            execaSync`cp -r ${currentWorkingDirectory + "/tests/fixtures/monorepo/" + path} ${tempDir}`
        })

    execaSync`yarn`
    execaSync`yarn add bumpp@9.6.1`
}

export const shortHash = () => Math.random().toString(16).substring(2, 7)
export const fullHash = () =>
    Array.from({ length: 8 }, () => shortHash()).join("")

export const getLatestTag = async () => {
    const [, newTag] =
        (await getLastTag().catch((err) => {
            console.error(new Error("getLastTag() error", { cause: err }))
            return undefined
        })) ?? []

    return newTag
}
