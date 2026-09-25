// Katawan ng liham: ginagawang totoong table (gaya ng Excel) ang mga
// pipe-table na linya (hal. "| Petsa | Halaga |") na galing sa Buwanang at
// Lingguhang Resibo. Ang ibang linya ay plain text pa rin.
const TABLE_LINE = /^\|.*\|$/;

type Block =
  | { kind: "text"; lines: string[] }
  | { kind: "table"; rows: string[][] }
  | { kind: "total"; line: string; grand: boolean };

// Mga linya ng kabuuan sa resibo (hal. "Kabuuan ng Ambagan: ₱...",
// "PANGKALAHATANG KABUUAN: ₱...").
const TOTAL_LINE = /^(Kabuuan ng|PANGKALAHATANG KABUUAN)/;

function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  let text: string[] = [];
  let rows: string[][] = [];
  const flushText = () => {
    if (text.length > 0) {
      blocks.push({ kind: "text", lines: text });
      text = [];
    }
  };
  const flushTable = () => {
    if (rows.length > 0) {
      blocks.push({ kind: "table", rows });
      rows = [];
    }
  };
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (TABLE_LINE.test(line)) {
      flushText();
      rows.push(line.split("|").slice(1, -1).map((c) => c.trim()));
    } else if (TOTAL_LINE.test(line)) {
      flushText();
      flushTable();
      blocks.push({ kind: "total", line, grand: line.startsWith("PANGKALAHATANG") });
    } else {
      flushTable();
      text.push(rawLine);
    }
  }
  flushText();
  flushTable();
  return blocks;
}

function ResiboTable({ rows }: { rows: string[][] }) {
  const [header, ...data] = rows;
  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse bg-white text-sm">
        <thead>
          <tr>
            {header.map((c, j) => (
              <th
                key={j}
                className="border border-gray-400 bg-emerald-700 px-2 py-1.5 text-left font-semibold text-white"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 1 ? "bg-emerald-50/40" : undefined}>
              {row.map((c, j) => (
                <td
                  key={j}
                  className={`border border-gray-400 px-2 py-1.5 text-gray-800 ${
                    j === row.length - 1 ? "text-right tabular-nums" : ""
                  }`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LetterBody({ body }: { body: string }) {
  const blocks = parseBlocks(body);
  return (
    <div className="text-sm text-gray-700">
      {blocks.map((b, i) => {
        if (b.kind === "table") return <ResiboTable key={i} rows={b.rows} />;
        if (b.kind === "total")
          return (
            <p
              key={i}
              className={
                b.grand
                  ? "my-2 rounded bg-emerald-200 px-3 py-2 text-base font-bold text-emerald-900 [print-color-adjust:exact]"
                  : "my-1 rounded bg-emerald-100 px-2 py-1.5 font-bold text-emerald-900 [print-color-adjust:exact]"
              }
            >
              {b.line}
            </p>
          );
        return (
          <p key={i} className="whitespace-pre-line">
            {b.lines.join("\n")}
          </p>
        );
      })}
    </div>
  );
}
