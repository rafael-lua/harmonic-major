'use strict';

const core = require('@actions/core');
const luxon = require('luxon');
const promises = require('fs/promises');
const pathe = require('pathe');
const execa = require('execa');
const semver = require('semver');

const ConventionalCommitRegex = /(?<type>[a-zA-Z]+)(\((?<scope>.+)\))?(?<breaking>!)?: (?<description>.+)/i;
const CoAuthoredByRegex = /co-authored-by:\s*(?<name>.+)(<(?<email>.+)>)/gim;
const parseGitCommit = (commit) => {
  const match = commit.message.match(ConventionalCommitRegex);
  if (!match?.groups)
    return null;
  const type = match.groups.type ?? "";
  const scope = match.groups.scope ?? "";
  const isBreaking = Boolean(match.groups.breaking);
  const description = match.groups.description ?? "";
  const authors = [commit.author];
  for (const match2 of commit.body.matchAll(CoAuthoredByRegex)) {
    if (match2.groups)
      authors.push({
        name: (match2.groups.name || "").trim(),
        email: (match2.groups.email || "").trim()
      });
  }
  return {
    ...commit,
    authors,
    description,
    type,
    scope,
    isBreaking
  };
};
const parseCommits = (commits) => {
  return commits.map((commit) => parseGitCommit(commit)).filter((v) => v !== null);
};
const getLastTag = async () => {
  const { stdout } = await execa.execa("git", [
    "for-each-ref",
    "--format=%(refname:short) %(objectname)",
    "--sort=-taggerdate",
    "--count=1",
    "refs/tags"
  ]);
  const [tag, sha] = stdout.split(" ");
  if (!tag || !sha)
    return void 0;
  return [tag, sha];
};
const getGitDiff = async (from, to = "HEAD") => {
  const range = `${from ? `${from}...` : ""}${to}`;
  const { stdout } = await execa.execa`git --no-pager log ${range} --pretty=${"---%n%s|%h|%an|%ae%n%b"}`;
  return stdout.split("---\n").splice(1).map((line) => {
    const [firstLine, ..._body] = line.split("\n");
    const [message, shortHash, authorName, authorEmail] = firstLine?.split("|") ?? "";
    const r = {
      message: message ?? "",
      shortHash: shortHash ?? "",
      author: { name: authorName ?? "", email: authorEmail ?? "" },
      body: _body.join("\n").trim()
    };
    return r;
  });
};
const createReleaseTag = async (version, message, hash = "HEAD") => {
  const validVersion = semver.valid(version);
  if (validVersion === null)
    throw new Error("Invalid tag semver version");
  return execa.execa("git", ["tag", "-a", `v${validVersion}`, "-m", message, hash]);
};
const getOwnerSlashRepo = () => {
  try {
    const remoteUrl = execa.execaSync("git", [
      "config",
      "--get",
      "remote.origin.url"
    ]).stdout.trim();
    const [, ownerSlashRepo] = remoteUrl.match(/github\.com[:/](.+?)(\.git)?$/) ?? [];
    if (!ownerSlashRepo)
      throw new Error("Could not find remote origin url");
    return ownerSlashRepo;
  } catch {
    throw new Error(
      "Could not find remote origin url in the current directory"
    );
  }
};
const getInitialCommit = () => {
  try {
    const initialCommit = execa.execaSync("git", [
      "rev-list",
      "--max-parents=0",
      "HEAD"
    ]).stdout.trim();
    return initialCommit;
  } catch (error) {
    throw new Error("Could not find any commits in the current directory", {
      cause: error
    });
  }
};

const staticHeader = "Changelogs are auto generated from commits using `harmonic-major` action.";
const changelogParseRegex = /\s(?=## \[(?:\d{1,3}.){3})/u;
const parseChangelog = (changelog) => {
  if (changelog === "")
    return [];
  const [, rest] = changelog.split(`${staticHeader}

`);
  if (!rest)
    throw new Error("parseChangelog > No changelog found");
  return rest.trim().split(changelogParseRegex);
};
const commitsTypeHeadings = {
  feat: "\u2728 Features",
  fix: "\u{1F41B} Fixes",
  chore: "\u{1F9F9} Chores",
  test: "\u{1F9EA} Tests"
};
const commitTypeMap = (v) => {
  switch (v) {
    case "feat":
      return "feat";
    case "fix":
      return "fix";
    case "test":
      return "test";
    default:
      return "chore";
  }
};
const makeLineBreaks = (n = 1) => "\n".repeat(n);
const withLineBreak = (v, n = 1) => `${v}${makeLineBreaks(n)}`;
const makeH2 = (v) => `## ${v}`;
const makeH3 = (v) => `### ${v}`;
const makeImportant = (v) => `\u26A0\uFE0F ${v}`;
const makeListItem = (v) => `-   ${v}`;
const makeImportantListItem = (v) => makeListItem(makeImportant(v));
const orderByImportant = (a, b) => +b.isBreaking - +a.isBreaking;
const getCommitLineBreak = (i, length) => {
  const isLast = i === length - 1;
  return isLast ? 2 : 1;
};
const changelogsWithoutHeader = (changelog) => {
  const [, ...rest] = changelog;
  return rest;
};
const makeDiffLink = (ownerSlashRepo, baseHash, compareHash) => `https://github.com/${ownerSlashRepo}/compare/${baseHash}...${compareHash}`;
const generateChangelog = (currentChangelog, newChangelog, lastTagSha) => {
  const releases = currentChangelog[0]?.startsWith("## ") ? currentChangelog : changelogsWithoutHeader(currentChangelog);
  let newRelease = "";
  const ownerSlashRepo = getOwnerSlashRepo();
  const firstCommit = getInitialCommit();
  const newTagHeading = `[${newChangelog.tag}](${makeDiffLink(ownerSlashRepo, lastTagSha ?? firstCommit, "HEAD")}) (${newChangelog.date})`;
  newRelease += withLineBreak(makeH2(newTagHeading), 2);
  const groupedCommits = {
    feat: [],
    fix: [],
    chore: [],
    test: []
  };
  newChangelog.commits.forEach((commit) => {
    const commitType = commitTypeMap(commit.type);
    groupedCommits[commitType]?.push(commit);
  });
  if (Object.values(groupedCommits).every((v) => v.length === 0)) {
    throw new Error("No commits found");
  }
  const headings = {
    feat: withLineBreak(makeH3(commitsTypeHeadings.feat), 2),
    fix: withLineBreak(makeH3(commitsTypeHeadings.fix), 2),
    chore: withLineBreak(makeH3(commitsTypeHeadings.chore), 2),
    test: withLineBreak(makeH3(commitsTypeHeadings.test), 2)
  };
  const commitKeys = Object.keys(groupedCommits);
  commitKeys.forEach((k) => {
    const commits = groupedCommits[k];
    if (commits.length > 0) {
      newRelease += headings[k];
      commits.sort(orderByImportant).forEach((commit, i) => {
        const lineBreaks = getCommitLineBreak(i, commits.length);
        if (commit.isBreaking) {
          newRelease += withLineBreak(
            makeImportantListItem(commit.message),
            lineBreaks
          );
        } else {
          newRelease += withLineBreak(
            makeListItem(commit.message),
            lineBreaks
          );
        }
      });
    }
  });
  newRelease = newRelease.slice(0, -1);
  return {
    header: withLineBreak(staticHeader),
    newRelease,
    releases
  };
};
const assembleChangelog = async ({
  header,
  newRelease,
  releases
}, lastTag) => {
  const [, newTag] = await getLastTag().catch((err) => {
    console.error(
      new Error("assembleChangelog > getLastTag() error", {
        cause: err
      })
    );
    return void 0;
  }) ?? [];
  if (!newTag || lastTag === newTag) {
    throw new Error("No new commits found");
  }
  const lastRelease = releases.shift();
  if (lastRelease !== void 0 && lastTag !== void 0) {
    const updatedRelease = lastRelease.replace(/(?<=\.{3})HEAD/, lastTag);
    releases.unshift(updatedRelease);
  }
  const updatedNewRelease = newRelease.replace(/(?<=\.{3})HEAD/, newTag);
  return [header, updatedNewRelease, ...releases].join("\n");
};
const readChangelog = async (changelogPath = "CHANGELOG.md") => {
  const rootDir = process.cwd();
  const changelogFile = await promises.readFile(pathe.resolve(rootDir, changelogPath), {
    encoding: "utf8"
  }).catch(() => "");
  return changelogFile;
};
const writeChangelog = async (changelog, changelogPath = "CHANGELOG.md") => {
  const rootDir = process.cwd();
  await promises.writeFile(pathe.resolve(rootDir, changelogPath), changelog, {
    encoding: "utf8"
  });
};

const figureOutNextVersion = (commits, currentVersion) => {
  const versionKey = commits.reduce((acc, commit) => {
    const type = commit.type;
    if (commit.isBreaking || acc === "major")
      return "major";
    if (type === "feat" || acc === "minor")
      return "minor";
    return "patch";
  }, "patch");
  const nextVersion = semver.inc(currentVersion, versionKey);
  if (nextVersion === null)
    throw new Error(`Invalid version, got ${nextVersion}`);
  return {
    versionKey,
    versionValue: nextVersion
  };
};
const bumpPackages = ({
  versionKey,
  versionValue
}) => {
  console.info(`Bumping packages to ${versionValue}`);
  execa.execaSync`node node_modules/bumpp/bin/bumpp.js ${versionKey} -r -y --no-push --no-tag --all`;
};

const now = luxon.DateTime.now();
const release = async () => {
  const lastTag = await getLastTag().catch((err) => {
    console.error(new Error("getLastTag() error", { cause: err }));
    return void 0;
  });
  if (!lastTag)
    console.info("No recent tag found, will consider from the beginning");
  const [lastTagVersion, lastTagSha] = lastTag ?? ["0.0.0", void 0];
  const diff = await getGitDiff(lastTagSha).catch((err) => {
    console.error(new Error("getGitDiff() error", { cause: err }));
    return void 0;
  });
  if (!diff || diff.length === 0) {
    console.info("No diff found, skipping release");
    return void 0;
  }
  const commits = parseCommits(diff);
  const { versionKey, versionValue } = figureOutNextVersion(
    commits,
    lastTagVersion
  );
  const changelogFile = await readChangelog();
  const currentChangelog = parseChangelog(changelogFile);
  const newTag = `v${versionValue}`;
  const changelogs = generateChangelog(
    currentChangelog,
    {
      commits,
      date: now.toFormat("yyyy.M.d"),
      tag: newTag
    },
    lastTagSha
  );
  bumpPackages({ versionKey, versionValue });
  await createReleaseTag(versionValue, changelogs.newRelease).catch((err) => {
    console.error(new Error("createReleaseTag() error", { cause: err }));
    return void 0;
  });
  const changelog = await assembleChangelog(changelogs, lastTagSha);
  await writeChangelog(changelog).catch((err) => {
    console.error(new Error("writeChangelog() error", { cause: err }));
    return void 0;
  });
  return newTag;
};

const run = async () => {
  try {
    core.info("Release action started...");
    const newRelease = await release();
    if (newRelease) {
      core.setOutput("release", newRelease);
      core.info("New release created!");
    } else {
      core.info("No new release created!");
    }
  } catch (error) {
    core.setFailed(
      error instanceof Error ? error.message : `Unknown error: ${error}`
    );
  }
};
run();
