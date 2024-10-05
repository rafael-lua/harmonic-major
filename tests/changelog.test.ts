import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
    assembleChangelog,
    generateChangelog,
    makeDiffLink,
    parseChangelog,
    readChangelog,
    staticHeader,
    writeChangelog,
} from "../src/core/changelog"
import {
    createReleaseTag,
    getInitialCommit,
    getNthTag,
    getOwnerSlashRepo,
    type GitCommit,
} from "../src/core/git"
import {
    defaultRepositoryCommands,
    getLatestTag,
    setupTempGitRepository,
    shortHash,
} from "./testingUtils"
import { appendFileSync, rmSync, writeFileSync } from "fs"
import { execaSync } from "execa"
import { appendFile, unlink } from "fs/promises"

const README_FILE = "README.md"
const defaultGitCommands = (tmpDir: string) => {
    defaultRepositoryCommands(tmpDir)

    writeFileSync(README_FILE, "# Test")
    execaSync`git add ${README_FILE}`
    execaSync`git commit -m ${"Initial commit"}`
}

const changelogFixture = `${staticHeader}

## [1.0.0-beta.1](diff) (0000-00-00)

### ✨ Features

-   feat(scope): feature message

## [1.0.0-beta.1](diff) (0000-00-00)

### ✨ Features

-   feat(scope): feature message

## [1.0.0-beta.1](diff) (0000-00-00)

### ✨ Features

-   feat(scope): feature message
`

describe("parseChangelog", () => {
    it("should parse changelog values into an array of releases", () => {
        const got = parseChangelog(changelogFixture)

        expect(got).toHaveLength(3)

        got.forEach((v) => {
            expect(v.startsWith("## [")).toBeTruthy()
        })

        expect([`${staticHeader}\n`, ...got].join("\n")).toMatchInlineSnapshot(
            `"${changelogFixture.trim()}"`,
        )
    })
})

const makeCommit = (message: string): GitCommit => {
    return {
        description: message.split(":").pop() ?? "",
        scope: message.match(/(?!=\()\w+(?=\))/)?.[0] ?? "",
        authors: [
            {
                name: "John Doe",
                email: "john@doe.com",
            },
        ],
        isBreaking: /!:/.test(message),
        shortHash: shortHash(),
        type: message.match(/\w+(?=\()|\w+(?=!)|\w+(?=:)/u)?.[0] ?? "",
        message,
        body: "...",
        author: {
            name: "Rafael",
            email: "rafael@test.com",
        },
    }
}

describe("generateChangelog", () => {
    let tempRepoPath: string = ""

    beforeAll(async () => {
        tempRepoPath = await setupTempGitRepository(defaultGitCommands)
    })

    afterAll(() => {
        // Clean up the temporary directory
        rmSync(tempRepoPath, { recursive: true, force: true })
    })

    it("should generate a new changelog from provided commits", async () => {
        const currentChangelogFixture = await import(
            "./fixtures/changelog-basic.md?raw"
        )

        const currentChangelog = parseChangelog(currentChangelogFixture.default)

        const commits: GitCommit[] = [
            // Feats
            makeCommit("feat(scope): another feature message"),
            makeCommit("feat: feature scopeless"),
            // Fixes
            makeCommit("fix(scope)!: breaking fix"),
            makeCommit("fix: random fix"),
            // Chores
            makeCommit("chore(scope): daily chores"),
            makeCommit("refactor(scope): a little less messy"),
            makeCommit("docs(scope): how does this work"),
            // Tests
            makeCommit("test(scope): hopefully doesnt break"),
        ]

        const ownerSlashRepo = getOwnerSlashRepo()
        const firstCommit = getInitialCommit()

        const got = generateChangelog(currentChangelog, {
            commits,
            tag: "1.0.0",
            date: "0000-00-00",
        })

        const [header, ...releases] =
            currentChangelogFixture.default.split("\n")

        expect(got.header).toContain(header)
        expect(got.newRelease).toContain(
            `## [1.0.0](${makeDiffLink(ownerSlashRepo, firstCommit, "HEAD")}) (0000-00-00)`,
        )
        expect(got.releases).toHaveLength(1)
        expect(releases.join("\n").trim()).toEqual(got.releases[0])
    })

    it("throws if no commits are provided", () => {
        expect(() =>
            generateChangelog(
                [],
                {
                    commits: [],
                    tag: "1.0.0",
                    date: "0000-00-00",
                },
                shortHash(),
            ),
        ).toThrowError(new Error("No commits found"))
    })
})

describe("assembleChangelog", () => {
    let tempRepoPath: string = ""

    beforeAll(async () => {
        tempRepoPath = await setupTempGitRepository(defaultGitCommands)
    })

    afterAll(() => {
        // Clean up the temporary directory
        rmSync(tempRepoPath, { recursive: true, force: true })
    })

    it("should assemble a new changelog from provided commits", async () => {
        await createReleaseTag("0.0.0", "Message")

        const currentChangelogFixture = await import(
            "./fixtures/changelog-basic.md?raw"
        )

        const currentChangelog = parseChangelog(currentChangelogFixture.default)

        const commits: GitCommit[] = [
            // Feats
            makeCommit("feat(scope): another feature message"),
            makeCommit("feat: feature scopeless"),
            // Fixes
            makeCommit("fix(scope)!: breaking fix"),
            makeCommit("fix: random fix"),
            // Chores
            makeCommit("chore(scope): daily chores"),
            makeCommit("refactor(scope): a little less messy"),
            makeCommit("docs(scope): how does this work"),
            // Tests
            makeCommit("test(scope): hopefully doesnt break"),
        ]

        const firstCommit = "113df10b41c273f3acbc6ba0324de2b1e3a2acdf"
        const headCommit = "01ea2b3e28e5fdca59bbbedd694a473246294acf"

        const changelog = generateChangelog(currentChangelog, {
            commits,
            tag: "1.0.0",
            date: "0000-00-00",
        })

        appendFileSync(README_FILE, "# Test")
        execaSync`git add ${README_FILE}`
        execaSync`git commit -m ${"fix: update changelog"}`
        await createReleaseTag("1.0.0", changelog.newRelease)

        const got = await assembleChangelog(
            { ...changelog },
            await getNthTag(1),
        )

        const wantRaw = await import("./fixtures/changelog-two-releases.md?raw")
        const want = wantRaw.default
            .trim()
            .replace(firstCommit, getInitialCommit())
            .replace(headCommit, (await getLatestTag()) ?? "")

        expect(got).toMatchInlineSnapshot(`"${want}"`)
    })
})

describe("readChangelog", () => {
    let tempRepoPath: string = ""

    it("should return an empty string if there is no changelog", async () => {
        const got = await readChangelog()

        expect(got).toEqual("")
    })

    describe("with a changelog", () => {
        beforeAll(async () => {
            tempRepoPath = await setupTempGitRepository(async () => {
                const changelogFile = "CHANGELOG.md"
                execaSync`touch ${changelogFile}`
                await appendFile(changelogFile, "# Header")
            })
        })

        afterAll(() => {
            // Clean up the temporary directory
            rmSync(tempRepoPath, { recursive: true, force: true })
        })

        it("should return the contents of the changelog", async () => {
            const got = await readChangelog()

            expect(got).toMatchInlineSnapshot(`"# Header"`)
        })
    })
})

describe("writeChangelog", () => {
    let tempRepoPath: string = ""

    describe("with a changelog", () => {
        beforeAll(async () => {
            tempRepoPath = await setupTempGitRepository(async () => {
                await unlink("CHANGELOG.md").catch(() => {})
                const changelogFile = "CHANGELOG.md"
                execaSync`touch ${changelogFile}`
                await appendFile(changelogFile, "# Header")
            })
        })

        afterAll(() => {
            // Clean up the temporary directory
            rmSync(tempRepoPath, { recursive: true, force: true })
        })

        describe("without a changelog", () => {
            beforeEach(async () => {
                await unlink("CHANGELOG.md").catch(() => {})
            })

            it("should write an new changelog", async () => {
                await writeChangelog(changelogFixture)
                const got = await readChangelog()

                expect(changelogFixture).toEqual(got)
            })
        })

        describe("with a existing changelog", () => {
            beforeEach(async () => {
                await unlink("CHANGELOG.md").catch(() => {})
                await writeChangelog("# Header")
            })

            it("should write the new changelog", async () => {
                await writeChangelog(changelogFixture)
                const got = await readChangelog()

                expect(changelogFixture).toEqual(got)
            })
        })
    })
})
