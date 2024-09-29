import { describe, expect, it } from "vitest"
import {
    assembleChangelog,
    generateChangelog,
    parseChangelog,
} from "../src/core/changelog"
import type { GitCommit } from "../src/core/git"

describe("parseChangelog", () => {
    it("should parse changelog values into an array of releases", () => {
        const changelogFixture = `
Header

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
        const got = parseChangelog(changelogFixture)

        expect(got).toHaveLength(4)

        const [first, ...releases] = got

        expect(first?.startsWith("Header")).toBeTruthy()

        releases.forEach((v) => {
            expect(v.startsWith("## [")).toBeTruthy()
        })

        expect(got.join("\n")).toMatchInlineSnapshot(
            `"${changelogFixture.trim()}"`,
        )
    })
})

const shortHash = () => Math.random().toString(16).substring(2, 7)
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

        const got = generateChangelog(currentChangelog, {
            commits,
            tag: "1.0.0",
            date: "0000-00-00",
        })

        const [header, ...releases] =
            currentChangelogFixture.default.split("\n")

        expect(got.header).toContain(header)
        expect(got.newRelease).toContain("## [1.0.0](...) (0000-00-00)")
        expect(got.releases).toHaveLength(1)
        expect(releases.join("\n").trim()).toEqual(got.releases[0])
    })

    it("throws if no commits are provided", () => {
        expect(() =>
            generateChangelog([], {
                commits: [],
                tag: "1.0.0",
                date: "0000-00-00",
            }),
        ).toThrowError(new Error("No commits found"))
    })
})

describe("assembleChangelog", () => {
    it("should assemble a new changelog from provided commits", async () => {
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

        const changelog = generateChangelog(currentChangelog, {
            commits,
            tag: "1.0.0",
            date: "0000-00-00",
        })

        const got = assembleChangelog({ ...changelog })

        const want = await import("./fixtures/changelog-two-releases.md?raw")

        expect(got).toMatchInlineSnapshot(`"${want.default.trim()}"`)
    })
})
