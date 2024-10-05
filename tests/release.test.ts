import { appendFileSync, rmSync, writeFileSync } from "fs"
import { execaSync } from "execa"
import { DateTime } from "luxon"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { readChangelog } from "../src/core/changelog"
import { getInitialCommit, getNthTag, getTagAmount } from "../src/core/git"
import release from "../src/core/release"
import { wait } from "../src/utils"
import {
    defaultRepositoryCommands,
    getLatestTag,
    setupTempGitRepository,
} from "./testingUtils"

const makeInitialCommit = () => {
    const README_FILE = "README.md"

    writeFileSync(README_FILE, "# Test")
    execaSync`git add ${README_FILE}`
    execaSync`git commit -m ${"chore: initial commit"}`
}

const makeRandomCommit = (
    level: "major" | "minor" | "patch",
    type: "chore" | "fix" | "test" | "feat" | "refactor",
    scope?: string | null,
    isBreaking?: boolean,
) => {
    const README_FILE = "README.md"

    let commit = scope
        ? `${type}(${scope}): ${level} commit`
        : `${type}: ${level} commit`

    if (isBreaking) commit = commit.replace(":", "!:")

    appendFileSync(README_FILE, `\n\n# ${commit}`)
    execaSync`git add ${README_FILE}`
    execaSync`git commit -m ${commit}`
}

const now = DateTime.now()

describe("release tests", () => {
    let tempRepoPath: string = ""

    beforeEach(async () => {
        // Since git comits are timed by second, there could be order incosistency if test run too fast
        await wait(1000)
    })

    beforeAll(async () => {
        tempRepoPath = await setupTempGitRepository(defaultRepositoryCommands)
    })

    afterAll(() => {
        // Clean up the temporary directory
        rmSync(tempRepoPath, { recursive: true, force: true })
    })

    it("should create release v0.0.1", async () => {
        makeInitialCommit()

        await release()
        const got = await readChangelog()

        const newTag = await getLatestTag()

        const expectedVersion = "v0.0.1"

        expect(await getTagAmount()).toBe(1)
        expect(got).toMatchInlineSnapshot(`
            "Changelogs are auto generated from commits using \`harmonic-major\` action.

            ## [${expectedVersion}](https://github.com/testowner/testrepo/compare/${getInitialCommit()}...${newTag}) (${now.toFormat("yyyy.M.d")})

            ### 🧹 Chores

            -   chore: initial commit
            "`)
    })

    it("should create release v0.0.2", async () => {
        makeRandomCommit("patch", "chore")

        const lastTag = await getLatestTag()

        await release()
        const got = await readChangelog()

        const newTag = await getLatestTag()

        const expectedVersion = "v0.0.2"

        expect(await getTagAmount()).toBe(2)
        expect(got).toMatchInlineSnapshot(`
            "Changelogs are auto generated from commits using \`harmonic-major\` action.
            
            ## [${expectedVersion}](https://github.com/testowner/testrepo/compare/${lastTag}...${newTag}) (${now.toFormat("yyyy.M.d")})

            ### 🧹 Chores

            -   chore: patch commit

            ## [v0.0.1](https://github.com/testowner/testrepo/compare/${getInitialCommit()}...${lastTag}) (${now.toFormat("yyyy.M.d")})

            ### 🧹 Chores

            -   chore: initial commit"`)
    })

    it("should create release v0.0.3", async () => {
        makeRandomCommit("patch", "fix")
        makeRandomCommit("patch", "fix")

        const lastTag = await getLatestTag()

        await release()
        const got = await readChangelog()

        const newTag = await getLatestTag()

        const tag002 = await getNthTag(2)

        const expectedVersion = "v0.0.3"

        expect(await getTagAmount()).toBe(3)
        expect(got).toMatchInlineSnapshot(`
            "Changelogs are auto generated from commits using \`harmonic-major\` action.
            
            ## [${expectedVersion}](https://github.com/testowner/testrepo/compare/${lastTag}...${newTag}) (${now.toFormat("yyyy.M.d")})

            ### 🐛 Fixes

            -   fix: patch commit
            -   fix: patch commit

            ## [v0.0.2](https://github.com/testowner/testrepo/compare/${tag002}...${lastTag}) (${now.toFormat("yyyy.M.d")})

            ### 🧹 Chores

            -   chore: patch commit

            ## [v0.0.1](https://github.com/testowner/testrepo/compare/${getInitialCommit()}...${tag002}) (${now.toFormat("yyyy.M.d")})

            ### 🧹 Chores

            -   chore: initial commit"`)
    })

    it("should create release v0.1.0", async () => {
        makeRandomCommit("patch", "refactor")
        makeRandomCommit("patch", "test", "scope1")
        makeRandomCommit("minor", "feat", "scope2")

        const lastTag = await getLatestTag()

        await release()
        const got = await readChangelog()

        const newTag = await getLatestTag()

        const tag002 = await getNthTag(3)
        const tag003 = await getNthTag(2)

        const expectedVersion = "v0.1.0"

        expect(await getTagAmount()).toBe(4)
        expect(got).toMatchInlineSnapshot(`
            "Changelogs are auto generated from commits using \`harmonic-major\` action.
            
            ## [${expectedVersion}](https://github.com/testowner/testrepo/compare/${lastTag}...${newTag}) (${now.toFormat("yyyy.M.d")})

            ### ✨ Features

            -   feat(scope2): minor commit

            ### 🧹 Chores

            -   refactor: patch commit

            ### 🧪 Tests
            
            -   test(scope1): patch commit

            ## [v0.0.3](https://github.com/testowner/testrepo/compare/${tag003}...${lastTag}) (${now.toFormat("yyyy.M.d")})

            ### 🐛 Fixes

            -   fix: patch commit
            -   fix: patch commit

            ## [v0.0.2](https://github.com/testowner/testrepo/compare/${tag002}...${tag003}) (${now.toFormat("yyyy.M.d")})

            ### 🧹 Chores

            -   chore: patch commit

            ## [v0.0.1](https://github.com/testowner/testrepo/compare/${getInitialCommit()}...${tag002}) (${now.toFormat("yyyy.M.d")})

            ### 🧹 Chores

            -   chore: initial commit"`)
    })

    it("should create release v1.0.0", async () => {
        makeRandomCommit("major", "feat", "scope", true)

        const lastTag = await getLatestTag()

        await release()
        const got = await readChangelog()

        const newTag = await getLatestTag()

        const tag002 = await getNthTag(4)
        const tag003 = await getNthTag(3)
        const tag010 = await getNthTag(2)

        const expectedVersion = "v1.0.0"

        expect(await getTagAmount()).toBe(5)
        expect(got).toMatchInlineSnapshot(`
            "Changelogs are auto generated from commits using \`harmonic-major\` action.
            
            ## [${expectedVersion}](https://github.com/testowner/testrepo/compare/${lastTag}...${newTag}) (${now.toFormat("yyyy.M.d")})

            ### ✨ Features

            -   ⚠️ feat(scope)!: major commit

            ## [v0.1.0](https://github.com/testowner/testrepo/compare/${tag010}...${lastTag}) (${now.toFormat("yyyy.M.d")})

            ### ✨ Features

            -   feat(scope2): minor commit

            ### 🧹 Chores

            -   refactor: patch commit

            ### 🧪 Tests
            
            -   test(scope1): patch commit

            ## [v0.0.3](https://github.com/testowner/testrepo/compare/${tag003}...${tag010}) (${now.toFormat("yyyy.M.d")})

            ### 🐛 Fixes

            -   fix: patch commit
            -   fix: patch commit

            ## [v0.0.2](https://github.com/testowner/testrepo/compare/${tag002}...${tag003}) (${now.toFormat("yyyy.M.d")})

            ### 🧹 Chores

            -   chore: patch commit

            ## [v0.0.1](https://github.com/testowner/testrepo/compare/${getInitialCommit()}...${tag002}) (${now.toFormat("yyyy.M.d")})

            ### 🧹 Chores

            -   chore: initial commit"`)
    })
})
