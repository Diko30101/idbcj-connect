import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `Ikaw ang AI assistant ng IDBCJ.org website. Sumasagot ka sa mga tanong ng mga bumibisita sa homepage.

TUNGKOL SA IDBCJ:
Ang Iglesia ng Dios na Buhay kay Cristo Jesus (IDBCJ) ay itinatag noong 1954 ni Mr. Avelino C. Santiago at rehistrado sa SEC noong 1958 (SEC Reg. No. 13708).

MGA LOKAL AT ORAS NG PAGSAMBA:
- Medina, Magallanes, Cavite: Every Sunday, 9:00 AM
- Sta. Teresita, Sto. Tomas, Batangas: Every Sunday, 9:00 AM and 3:00 PM
- Fort McMurray, Alberta, Canada: Every Sunday, 7:00 PM

LIVESTREAM:
Ang Sunday worship sa Medina ay naka-livestream sa IDBCJ YouTube channel at sa online church website. Makikita rin ito sa private Facebook group (para sa members lang).

PARA SA MEMBERS:
Mag-sign in sa IDBCJ Connect portal para sa announcements, ministries, prayer requests, at member profile.

CONTACT:
May "Send Us a Message" form sa website para sa prayer requests, questions, o pagbati.

MGA TUNTUNIN:
1. Sumagot sa wikang ginamit ng nagtatanong (Tagalog, English, o Taglish).
2. Maikli at diretso — huwag mahaba.
3. Kung hindi mo alam ang sagot, sabihin nang tapat at i-refer sa Contact form.
4. Huwag mag-imbento ng impormasyon tungkol sa doktrina, schedule, o church leadership.
5. Para sa prayer requests o personal na problema, i-refer sa "Send Us a Message" form.
6. Huwag pag-usapan ang internal church matters (finance, membership records, atbp.).`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
    }

    // Limit conversation history to last 10 messages to control cost
    const recentMessages = messages.slice(-10);

    // Subukan ang primary model, kung rate-limited ay mag-fallback sa iba
    const models = [
      "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free",
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    ];

    let data;
    let lastError = "";
    for (const model of models) {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://idbcj.org",
          "X-Title": "IDBCJ Website Chat",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...recentMessages,
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        data = await response.json();
        break;
      }
      lastError = `Model ${model}: ${response.status}`;
      if (response.status !== 429) break; // Kung hindi rate limit, huwag nang mag-fallback
    }

    if (!data) throw new Error(lastError || "All models failed");
    const reply = data.choices?.[0]?.message?.content || "Paumanhin, hindi ko nasagot iyan.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "May problema sa ngayon." },
      { status: 500 }
    );
  }
}
