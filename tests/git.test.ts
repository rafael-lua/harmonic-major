import { execaSync } from "execa"

import fs from "fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
    createReleaseTag,
    getGitDiff,
    getInitialCommit,
    getOwnerSlashRepo,
    parseCommits,
} from "../src/core/git"
import { setupTempGitRepository } from "./testingUtils"

const defaultGitCommands = () => {
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
}

const shortHashRegex = /^[a-f0-9]{7}$/

describe("commit tests", () => {
    let tempRepoPath: string = ""

    beforeAll(async () => {
        tempRepoPath = await setupTempGitRepository(defaultGitCommands)
    })

    afterAll(() => {
        // Clean up the temporary directory
        fs.rmSync(tempRepoPath, { recursive: true, force: true })
    })

    describe("getGitDiff", () => {
        it("should return the expected values", async () => {
            const got = await getGitDiff()

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

            expect(want).toEqual(got)
        })

        it("should return the expected values from range", async () => {
            const got = await getGitDiff("HEAD~2")

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

            expect(want).toEqual(got)
        })
    })

    describe("parseCommits", () => {
        it("should return the expected values", async () => {
            const commits = await getGitDiff()
            const got = parseCommits(commits)

            expect(got).toEqual([
                {
                    message: "fix!: THIS BREAKS EVERYTHING",
                    shortHash: expect.stringMatching(shortHashRegex),
                    author: { name: "Test User", email: "test@example.com" },
                    body: "",
                    authors: [{ name: "Test User", email: "test@example.com" }],
                    description: "THIS BREAKS EVERYTHING",
                    type: "fix",
                    scope: "",
                    isBreaking: true,
                },
                {
                    message: "chore: update readme with body",
                    shortHash: expect.stringMatching(shortHashRegex),
                    author: { name: "Test User", email: "test@example.com" },
                    body: "My body goes here.",
                    authors: [{ name: "Test User", email: "test@example.com" }],
                    description: "update readme with body",
                    type: "chore",
                    scope: "",
                    isBreaking: false,
                },
                {
                    message: "chore(scope): update readme",
                    shortHash: expect.stringMatching(shortHashRegex),
                    author: { name: "Test User", email: "test@example.com" },
                    body: "",
                    authors: [{ name: "Test User", email: "test@example.com" }],
                    description: "update readme",
                    type: "chore",
                    scope: "scope",
                    isBreaking: false,
                },
            ])
        })
    })
})

describe("tag tests", () => {
    let tempRepoPath: string = ""

    beforeAll(async () => {
        tempRepoPath = await setupTempGitRepository(() => {
            const README_FILE = "README.md"

            fs.writeFileSync(README_FILE, "# Test")
            execaSync`git add ${README_FILE}`
            execaSync`git commit -m ${"Initial commit"}`
        })
    })

    afterAll(() => {
        // Clean up the temporary directory
        fs.rmSync(tempRepoPath, { recursive: true, force: true })
    })

    it("should create the expected releases", async () => {
        const releaseCommand = await createReleaseTag(
            "v0.0.0",
            "Initial commit",
        )

        expect(releaseCommand.failed).toEqual(false)

        const { stdout: headSha } = execaSync`git rev-parse HEAD`
        const { stdout: tagSha } = execaSync`git rev-list -n 1 v0.0.0`

        expect(tagSha).toEqual(headSha)
    })
})

describe("diff tag tests", () => {
    let tempRepoPath: string = ""

    beforeAll(async () => {
        tempRepoPath = await setupTempGitRepository(async () => {
            const README_FILE = "README.md"

            fs.writeFileSync(README_FILE, "# Test")
            execaSync`git add ${README_FILE}`
            execaSync`git commit -m ${"Initial commit"}`

            await createReleaseTag("v0.0.0", "Initial commit")

            fs.appendFileSync(README_FILE, "\n\nBREAKING")
            execaSync`git add ${README_FILE}`
            execaSync`git commit -m ${"fix!: THIS BREAKS EVERYTHING"}`

            await createReleaseTag("v1.0.0", "fix: BREAKING")

            fs.appendFileSync(README_FILE, "\n\nNew major!")
            execaSync`git add ${README_FILE}`
            execaSync`git commit -m ${"feat!: major"}`

            await createReleaseTag("v2.0.0", "feat: Major")
        })
    })

    afterAll(() => {
        // Clean up the temporary directory
        fs.rmSync(tempRepoPath, { recursive: true, force: true })
    })

    it("should return the expected range diff (from TAG to HEAD)", async () => {
        const got = await getGitDiff("v0.0.0")

        const want = [
            {
                message: "feat!: major",
                shortHash: expect.stringMatching(shortHashRegex),
                author: { name: "Test User", email: "test@example.com" },
                body: "",
            },
            {
                message: "fix!: THIS BREAKS EVERYTHING",
                shortHash: expect.stringMatching(shortHashRegex),
                author: { name: "Test User", email: "test@example.com" },
                body: "",
            },
        ]

        expect(want).toEqual(got)
    })

    it("should return the expected range diff (from TAG to TAG)", async () => {
        const got = await getGitDiff("v0.0.0", "v1.0.0")

        const want = [
            {
                message: "fix!: THIS BREAKS EVERYTHING",
                shortHash: expect.stringMatching(shortHashRegex),
                author: { name: "Test User", email: "test@example.com" },
                body: "",
            },
        ]

        expect(want).toEqual(got)
    })
})

describe("utilities tests", () => {
    let tempRepoPath: string = ""

    beforeAll(async () => {
        tempRepoPath = await setupTempGitRepository(defaultGitCommands)
    })

    afterAll(() => {
        // Clean up the temporary directory
        fs.rmSync(tempRepoPath, { recursive: true, force: true })
    })

    describe("getOwnerSlashRepo()", () => {
        it("should extract owner and repo information", () => {
            const ownerSlashRepo = getOwnerSlashRepo()
            expect(ownerSlashRepo).toEqual("testowner/testrepo")
        })

        it("should throw if no remote origin is present", () => {
            execaSync`git remote remove origin`
            expect(() => getOwnerSlashRepo()).toThrowError(
                "Could not find remote origin url in the current directory",
            )
        })
    })

    describe("getInitialCommit()", () => {
        it("should extract owner and repo information", () => {
            const firstCommit = getInitialCommit()
            expect(firstCommit).toEqual(
                execaSync`git rev-list ${"--max-parents=0"} HEAD`.stdout,
            )
        })

        it("should throw if there is no commits yet", () => {
            execaSync`rm -rf .git`
            execaSync`git init`
            expect(() => getInitialCommit()).toThrowError(
                "Could not find any commits in the current directory",
            )
        })
    })
})
