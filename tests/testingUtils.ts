import { execa, execaSync, parseCommandString } from "execa"
import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import { join } from "pathe"

export const setupTempGitRepository = async (
    fn: (tempDir: string) => void | Promise<void>,
) => {
    const tempDir = mkdtempSync(join(tmpdir(), "git-test-"))
    process.chdir(tempDir)

    execaSync`git init`
    execaSync`git config user.email ${"test@example.com"}`
    execaSync`git config user.name ${"Test User"}`

    await fn(tempDir)

    return tempDir
}

export const runCmd = async (v: string) => {
    const { stdout } = await execa`${parseCommandString(v)}`
    console.log(stdout)
    return stdout
}

export const shortHash = () => Math.random().toString(16).substring(2, 7)
