const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generateReview(diffs) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in environment variables");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
You are a senior developer at a multinational company and you have knowledge of all languages. 
Please review the following code changes in these files :

${diffs}

---

Your mission:

- Review the proposed code changes file by file and by significant modification.
- Provide your review as a clear markdown list of comments. DO NOT output a git diff or patch format.
- Focus on potential bugs, formatting, or logic issues.
- Ignore files without patches.
- State the file name and the issue clearly.
`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

module.exports = {
  generateReview
};
