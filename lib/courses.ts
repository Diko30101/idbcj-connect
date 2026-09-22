// Ligtas gamitin sa browser at sa server (walang server-only import dito)

export type QuizChoice = { text: string; correct: boolean };
export type QuizQuestion = { question: string; choices: QuizChoice[] };

// Isang textarea lang ang ginagamit para sa buong quiz ng isang aralin.
// Blangkong linya ang naghihiwalay ng bawat tanong. Sa loob ng isang
// tanong, ang unang linya ay ang tanong mismo; ang mga susunod na linya
// na nagsisimula sa "* " ay TAMANG sagot, at "- " ay MALING choice.
// Hal.:
//   Sino ang sumulat ng Ebanghelyo ni Juan?
//   * Apostol Juan
//   - Pedro
//   - Pablo
//
// Isang tanong na walang tamang sagot ay hindi isinasama (best-effort,
// tulad ng tolerant na parsing ng ibang free-text fields sa sermons).
export function parseQuizText(text: string): QuizQuestion[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const quiz: QuizQuestion[] = [];
  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;
    const question = lines[0];
    const choices: QuizChoice[] = [];
    for (const line of lines.slice(1)) {
      if (line.startsWith("* ")) choices.push({ text: line.slice(2).trim(), correct: true });
      else if (line.startsWith("- ")) choices.push({ text: line.slice(2).trim(), correct: false });
    }
    const validChoices = choices.filter((c) => c.text);
    if (question && validChoices.some((c) => c.correct)) {
      quiz.push({ question, choices: validChoices });
    }
  }
  return quiz;
}

export function formatQuizText(quiz: QuizQuestion[]): string {
  return quiz
    .map((q) => [q.question, ...q.choices.map((c) => `${c.correct ? "*" : "-"} ${c.text}`)].join("\n"))
    .join("\n\n");
}
