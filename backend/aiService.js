const { GoogleGenerativeAI } = require("@google/generative-ai");

async function generateReview(diffs) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in environment variables");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
You are an elite senior software engineer performing a REAL pull request review at a top product engineering company.

Review the following PR diffs carefully.

========================
CODE CHANGES
========================

${diffs}

========================
REVIEW RULES
========================

Your job is NOT to praise code.
Your job is NOT to explain obvious things.
Your job is NOT to act like a linter.

ONLY comment when there is:
- a real bug
- possible runtime issue
- security issue
- scalability concern
- bad async handling
- bad error handling
- memory issue
- performance issue
- maintainability problem
- architectural flaw
- API misuse
- race condition
- incorrect logic
- edge case failure
- bad React pattern
- backend reliability concern
- database inefficiency

DO NOT comment on:
- indentation
- formatting
- naming preferences
- semicolons
- stylistic preferences
- trivial clean code suggestions
- obvious code
- low-confidence assumptions

If the code is acceptable, return:
"LGTM"

IMPORTANT:
- Be highly selective.
- Fewer comments are BETTER than noisy comments.
- Ignore harmless issues.
- Never hallucinate fake bugs.
- Never invent problems without strong evidence.
- Do not speculate.
- Only mention issues you are highly confident about.
- Act like an experienced engineer protecting developer productivity.

========================
OUTPUT FORMAT
========================

Return ONLY markdown.

For each issue use:

### [SEVERITY: HIGH/MEDIUM/LOW]
File: <filename>
Lines: <line numbers>

Issue:
<clear explanation>

Suggested Fix:
<short practical fix>

Code Example (only if necessary):
\`\`\`
code here
\`\`\`

If there are no meaningful issues:
return ONLY:
LGTM
`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

module.exports = {
  generateReview,
};
