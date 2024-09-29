import { join } from "pathe"
import { execaSync } from "execa"

import fs from "fs"
import os from "os"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { getGitDiff } from "../src/core/git"

const setupTempGitRepository = () => {
    const tempDir = fs.mkdtempSync(join(os.tmpdir(), "git-test-"))
    process.chdir(tempDir)

    execaSync`git init`
    execaSync`git config user.email ${"test@example.com"}`
    execaSync`git config user.name ${"Test User"}`

    const README_FILE = "README.md"

    fs.writeFileSync(README_FILE, "# Test")
    execaSync`git add ${README_FILE}`
    execaSync`git commit -m ${"Initial commit"}`

    fs.appendFileSync(README_FILE, "\nTesting repository")
    execaSync`git add ${README_FILE}`
    execaSync`git commit -m ${"chore(scope): update readme"}`

    fs.appendFileSync(README_FILE, "\n\nBody commit")
    execaSync`git add ${README_FILE}`
    execaSync`git commit -m ${"chore: update readme with body\n\nMy body goes here."}`

    fs.appendFileSync(README_FILE, "\n\nBREAKING and scope")
    execaSync`git add ${README_FILE}`
    execaSync`git commit -m ${"fix!: THIS BREAKS EVERYTHING"}`

    return tempDir
}

describe("git tests", () => {
    let tempRepoPath: string = ""

    beforeAll(() => {
        tempRepoPath = setupTempGitRepository()
    })

    afterAll(() => {
        // Clean up the temporary directory
        fs.rmSync(tempRepoPath, { recursive: true, force: true })
    })

    describe("getGitDiff", () => {
        const shortHashRegex = /^[a-f0-9]{7}$/
        it("should return the expected values", async () => {
            const result = await getGitDiff()

            const want = [
                {
                    message: "fix!: THIS BREAKS EVERYTHING",
                    shortHash: expect.stringMatching(shortHashRegex),
                    author: { name: "Test User", email: "test@example.com" },
                    body: "",
                },
                {
                    message: "chore: update readme with body",
                    shortHash: expect.stringMatching(shortHashRegex),
                    author: { name: "Test User", email: "test@example.com" },
                    body: "My body goes here.",
                },
                {
                    message: "chore(scope): update readme",
                    shortHash: expect.stringMatching(shortHashRegex),
                    author: { name: "Test User", email: "test@example.com" },
                    body: "",
                },
                {
                    message: "Initial commit",
                    shortHash: expect.stringMatching(shortHashRegex),
                    author: { name: "Test User", email: "test@example.com" },
                    body: "",
                },
            ]

            expect(want).toEqual(result)
        })

        it("should return the expected values from range", async () => {
            const result = await getGitDiff("HEAD~2")

            const want = [
                {
                    message: "fix!: THIS BREAKS EVERYTHING",
                    shortHash: expect.stringMatching(shortHashRegex),
                    author: { name: "Test User", email: "test@example.com" },
                    body: "",
                },
                {
                    message: "chore: update readme with body",
                    shortHash: expect.stringMatching(shortHashRegex),
                    author: { name: "Test User", email: "test@example.com" },
                    body: "My body goes here.",
                },
            ]

            expect(want).toEqual(result)
        })
    })
})
