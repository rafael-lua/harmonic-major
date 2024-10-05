import { rmSync } from "fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
    defaultRepositoryCommands,
    setupTempGitRepository,
    shortHash,
} from "./testingUtils"
import { execaSync } from "execa"
import { bumpPackages, figureOutNextVersion } from "../src/core/version"

const defaultAuthor = { name: "Test User", email: "test@example.com" }
const testCommits = {
    v0_0_0: {
        message: "chore(scope): commit 0.0.1",
        shortHash: shortHash(),
        author: defaultAuthor,
        body: "",
        authors: [defaultAuthor],
        description: "commit 0.0.0",
        type: "chore",
        scope: "scope",
        isBreaking: false,
    },
    v0_0_1: {
        message: "fix(scope): commit 0.0.2",
        shortHash: shortHash(),
        author: defaultAuthor,
        body: "",
        authors: [defaultAuthor],
        description: "commit 0.0.1",
        type: "fix",
        scope: "scope",
        isBreaking: false,
    },
    v0_1_0: {
        message: "feat(scope): commit 0.1.0",
        shortHash: shortHash(),
        author: defaultAuthor,
        body: "",
        authors: [defaultAuthor],
        description: "commit 0.1.0",
        type: "feat",
        scope: "scope",
        isBreaking: false,
    },
    v1_0_0: {
        message: "feat(scope)!: commit 1.0.0",
        shortHash: shortHash(),
        author: defaultAuthor,
        body: "",
        authors: [defaultAuthor],
        description: "commit 1.0.0",
        type: "feat",
        scope: "scope",
        isBreaking: true,
    },
}

describe("bumpPackages", () => {
    let tempRepoPath: string = ""

    beforeAll(async () => {
        tempRepoPath = await setupTempGitRepository(defaultRepositoryCommands)
    })

    afterAll(() => {
        // Clean up the temporary directory
        rmSync(tempRepoPath, { recursive: true, force: true })
    })

    it(
        "should bump packages (chores with patch)",
        { timeout: 15_000 },
        async () => {
            const { versionKey, versionValue } = figureOutNextVersion(
                [testCommits.v0_0_0],
                "0.0.0",
            )
            bumpPackages({ versionKey, versionValue })

            const expectedVersion = "0.0.1"

            expect(execaSync`cat package.json`.stdout).toMatchInlineSnapshot(`
            "{
                "name": "test-package",
                "version": "${expectedVersion}",
                "private": true,
                "workspaces": [
                    "packages/*"
                ],
                "dependencies": {
                    "bumpp": "9.6.1"
                }
            }"`)

            expect(execaSync`cat packages/package1/package.json`.stdout)
                .toMatchInlineSnapshot(`
            "{
                "name": "@my-org/package1",
                "version": "${expectedVersion}",
                "private": true
            }"`)

            expect(execaSync`cat packages/package2/package.json`.stdout)
                .toMatchInlineSnapshot(`
            "{
                "name": "@my-org/package2",
                "version": "${expectedVersion}",
                "private": true
            }"`)

            const fixedHash = shortHash()
            expect(
                execaSync`git log --oneline`.stdout.replace(/^.{7}/, fixedHash),
            ).toMatchInlineSnapshot(
                `"${fixedHash} chore: release v${expectedVersion}"`,
            )
        },
    )

    it(
        "should bump packages (fix with patch)",
        { timeout: 15_000 },
        async () => {
            const { versionKey, versionValue } = figureOutNextVersion(
                [testCommits.v0_0_0, testCommits.v0_0_1],
                "0.0.1",
            )
            bumpPackages({ versionKey, versionValue })

            const expectedVersion = "0.0.2"

            expect(execaSync`cat package.json`.stdout).toMatchInlineSnapshot(`
            "{
                "name": "test-package",
                "version": "${expectedVersion}",
                "private": true,
                "workspaces": [
                    "packages/*"
                ],
                "dependencies": {
                    "bumpp": "9.6.1"
                }
            }"`)

            expect(execaSync`cat packages/package1/package.json`.stdout)
                .toMatchInlineSnapshot(`
            "{
                "name": "@my-org/package1",
                "version": "${expectedVersion}",
                "private": true
            }"`)

            expect(execaSync`cat packages/package2/package.json`.stdout)
                .toMatchInlineSnapshot(`
            "{
                "name": "@my-org/package2",
                "version": "${expectedVersion}",
                "private": true
            }"`)

            const fixedHash = shortHash()
            expect(
                execaSync`git log --oneline`.stdout.replaceAll(
                    /^.{7}/gm,
                    fixedHash,
                ),
            ).toMatchInlineSnapshot(`
                "${fixedHash} chore: release v${expectedVersion}
                ${fixedHash} chore: release v0.0.1"`)
        },
    )

    it(
        "should bump packages (feat with minor)",
        { timeout: 15_000 },
        async () => {
            const { versionKey, versionValue } = figureOutNextVersion(
                [testCommits.v0_0_0, testCommits.v0_0_1, testCommits.v0_1_0],
                "0.0.2",
            )
            bumpPackages({ versionKey, versionValue })

            const expectedVersion = "0.1.0"

            expect(execaSync`cat package.json`.stdout).toMatchInlineSnapshot(`
            "{
                "name": "test-package",
                "version": "${expectedVersion}",
                "private": true,
                "workspaces": [
                    "packages/*"
                ],
                "dependencies": {
                    "bumpp": "9.6.1"
                }
            }"`)

            expect(execaSync`cat packages/package1/package.json`.stdout)
                .toMatchInlineSnapshot(`
            "{
                "name": "@my-org/package1",
                "version": "${expectedVersion}",
                "private": true
            }"`)

            expect(execaSync`cat packages/package2/package.json`.stdout)
                .toMatchInlineSnapshot(`
            "{
                "name": "@my-org/package2",
                "version": "${expectedVersion}",
                "private": true
            }"`)

            const fixedHash = shortHash()
            expect(
                execaSync`git log --oneline`.stdout.replaceAll(
                    /^.{7}/gm,
                    fixedHash,
                ),
            ).toMatchInlineSnapshot(`
                "${fixedHash} chore: release v${expectedVersion}
                ${fixedHash} chore: release v0.0.2
                ${fixedHash} chore: release v0.0.1"`)
        },
    )

    it(
        "should bump packages (feat with major)",
        { timeout: 15_000 },
        async () => {
            const { versionKey, versionValue } = figureOutNextVersion(
                [
                    testCommits.v0_0_0,
                    testCommits.v0_0_1,
                    testCommits.v0_1_0,
                    testCommits.v1_0_0,
                ],
                "0.1.0",
            )
            bumpPackages({ versionKey, versionValue })

            const expectedVersion = "1.0.0"

            expect(execaSync`cat package.json`.stdout).toMatchInlineSnapshot(`
            "{
                "name": "test-package",
                "version": "${expectedVersion}",
                "private": true,
                "workspaces": [
                    "packages/*"
                ],
                "dependencies": {
                    "bumpp": "9.6.1"
                }
            }"`)

            expect(execaSync`cat packages/package1/package.json`.stdout)
                .toMatchInlineSnapshot(`
            "{
                "name": "@my-org/package1",
                "version": "${expectedVersion}",
                "private": true
            }"`)

            expect(execaSync`cat packages/package2/package.json`.stdout)
                .toMatchInlineSnapshot(`
            "{
                "name": "@my-org/package2",
                "version": "${expectedVersion}",
                "private": true
            }"`)

            const fixedHash = shortHash()
            expect(
                execaSync`git log --oneline`.stdout.replaceAll(
                    /^.{7}/gm,
                    fixedHash,
                ),
            ).toMatchInlineSnapshot(`
                "${fixedHash} chore: release v${expectedVersion}
                ${fixedHash} chore: release v0.1.0
                ${fixedHash} chore: release v0.0.2
                ${fixedHash} chore: release v0.0.1"`)
        },
    )
})