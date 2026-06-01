import fs from "fs";
import path from "path";

// Using standard fetch (Node 18+)
const token = process.env.GITHUB_TOKEN;
const repoOwner = "shouri123";
const repoName = "Late-Meet";
const readmePath = path.resolve("README.md");

/**
 * Sanitizes a string for safe inclusion in a markdown table cell.
 * Escapes pipe characters, backticks, brackets, and backslashes
 * that could break table formatting or enable injection.
 * Also strips HTML tags to prevent XSS via issue titles.
 */
function sanitizeForMarkdownTable(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/`/g, "\\`")
    .replace(/\n/g, " ")
    .replace(/\r/g, "")
    .trim();
}

/**
 * Validates that a URL is a legitimate GitHub issue URL.
 * Returns sanitized URL or empty string if invalid.
 */
function sanitizeIssueUrl(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return "";
    if (!parsed.pathname.includes("/issues/")) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

async function fetchOpenIssues() {
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/issues?state=open&per_page=100`;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Late-Meet-Updater",
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch issues: ${response.status} ${await response.text()}`);
  }

  const issues = await response.json();

  // Validate response structure
  if (!Array.isArray(issues)) {
    throw new Error("Unexpected API response: expected an array of issues");
  }

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
    if (list.length > 0) return list.map(sanitizeForMarkdownTable).join(", ");
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
    // Sanitize all API-sourced data before including in markdown
    const safeTitle = sanitizeForMarkdownTable(issue.title);
    const safeUrl = sanitizeIssueUrl(issue.html_url);
    const skills = parseSkills(issue.body);
    const issueNumber = Number.isInteger(issue.number) ? issue.number : "?";

    if (safeUrl) {
      table += `| [#${issueNumber}](${safeUrl}) | ${safeTitle} | ${skills} |\n`;
    } else {
      table += `| #${issueNumber} | ${safeTitle} | ${skills} |\n`;
    }
  }
  return table;
}

async function updateReadme() {
  try {
    console.log("Fetching open issues from GitHub...");
    const issues = await fetchOpenIssues();
    console.log(`Fetched ${issues.length} open issues.`);

    console.log("Generating difficulty tables...");
    const beginnerTable = generateTable(issues, "level:beginner");
    const intermediateTable = generateTable(issues, "level:intermediate");
    const advancedTable = generateTable(issues, "level:advanced");

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
    // lgtm [js/http-to-file-access] - File path is strictly hardcoded to README.md and issue titles/URLs are thoroughly HTML-escaped and sanitized
    fs.writeFileSync(readmePath, readme, "utf8");
    console.log("README.md has been successfully updated with latest open issues!");
  } catch (error) {
    console.error("Error updating README:", error);
    process.exit(1);
  }
}

updateReadme();
