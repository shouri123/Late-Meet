import fs from "fs";
import path from "path";

// Using standard fetch (Node 18+)
const token = process.env.GITHUB_TOKEN;
const repoOwner = "shouri123";
const repoName = "Late-Meet";
const readmePath = path.resolve("README.md");

async function fetchOpenIssues() {
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/issues?state=open&per_page=100`;
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Late-Meet-Updater",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch issues: ${response.status} ${await response.text()}`);
  }

  const issues = await response.json();
  // Filter out pull requests (GitHub API returns PRs as issues)
  return issues.filter((issue) => !issue.pull_request);
}

function parseSkills(body) {
  if (!body) return "General";
  // Try to extract skills from GSSoC issue template if present
  const match = body.match(/###\s*Skills\s*([\s\S]*?)(?:###|$)/i);
  if (match && match[1]) {
    const list = match[1]
      .trim()
      .split("\n")
      .map((s) => s.replace(/[-*+\s]/g, ""))
      .filter(Boolean);
    if (list.length > 0) return list.join(", ");
  }
  return "General";
}

function generateTable(issues, level) {
  const filtered = issues.filter((issue) =>
    issue.labels.some((label) => label.name.toLowerCase() === level.toLowerCase()),
  );

  if (filtered.length === 0) {
    return `*No open issues for this level right now! Stay tuned.*`;
  }

  let table = `| # | Title | Skills |\n| :---: | :--- | :--- |\n`;
  for (const issue of filtered) {
    // Extract skills if documented
    const skills = parseSkills(issue.body);
    table += `| [#${issue.number}](${issue.html_url}) | ${issue.title.replace(/\|/g, "\\|")} | ${skills} |\n`;
  }
  return table;
}

async function updateReadme() {
  try {
    console.log("Fetching open issues from GitHub...");
    const issues = await fetchOpenIssues();
    console.log(`Fetched ${issues.length} open issues.`);

    console.log("Generating difficulty tables...");
    const beginnerTable = generateTable(issues, "level-1");
    const intermediateTable = generateTable(issues, "level-2");
    const advancedTable = generateTable(issues, "level-3");

    const replacement = `<!-- START_ISSUE_TABLES -->
<div align="center">

#### 🟢 Beginner — \`level-1\`

${beginnerTable}

#### 🟡 Intermediate — \`level-2\`

${intermediateTable}

#### 🔴 Advanced — \`level-3\`

${advancedTable}

</div>
<!-- END_ISSUE_TABLES -->`;

    let readme = fs.readFileSync(readmePath, "utf8");
    const regex = /<!-- START_ISSUE_TABLES -->[\s\S]*?<!-- END_ISSUE_TABLES -->/;

    if (!regex.test(readme)) {
      console.error("Marker comments <!-- START_ISSUE_TABLES --> not found in README.md!");
      return;
    }

    readme = readme.replace(regex, replacement);
    fs.writeFileSync(readmePath, readme, "utf8");
    console.log("README.md has been successfully updated with latest open issues!");
  } catch (error) {
    console.error("Error updating README:", error);
    process.exit(1);
  }
}

updateReadme();
