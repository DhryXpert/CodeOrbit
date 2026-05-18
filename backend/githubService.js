/**
 * Fetch the changed files and their diffs from a GitHub Pull Request
 */
async function getPRDiffs(repoFullName, prNumber, token) {
  const url = `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/files`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const files = await response.json();
  let diffs = '';

  for (const file of files) {
    diffs += `### Fichier : ${file.filename}\n\n`;

    if (file.patch) {
      // IMPORTANT : Replace triple backticks to avoid breaking markdown formatting
      const safePatch = file.patch.replace(/```/g, "''");
      diffs += "```diff\n";
      diffs += safePatch;
      diffs += "\n```\n";
    } else {
      diffs += "_Pas de patch disponible (probablement fichier binaire)._";
    }

    diffs += "\n---\n\n";
  }

  return diffs;
}

/**
 * Post the AI-generated review as a comment on the GitHub Pull Request
 */
async function postPRComment(repoFullName, prNumber, body, token) {
  const url = `https://api.github.com/repos/${repoFullName}/issues/${prNumber}/comments`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ body })
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

module.exports = {
  getPRDiffs,
  postPRComment
};
