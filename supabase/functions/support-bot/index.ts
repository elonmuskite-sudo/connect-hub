import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const INSTRUCTIONS = `You are Nexus Assist, the guided support assistant inside the Nexus Chat messaging app.
Help members with: finding people by their 10-digit Nexus ID (format 10-XXXX-XXXX, typed into the search box on the Chats tab),
starting private chats, saving contacts, calls, profile and password settings, and general app questions.
Keep replies short (1-4 sentences), friendly and practical. Never invent account details.
Set "handoff" to true when the member asks for a human/admin/agent, reports a billing, safety, abuse, account-locked or data problem,
or when you cannot resolve the issue after a clear attempt. When handing off, tell them a live admin will join this chat.`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "handoff", "reason"],
  properties: {
    reply: { type: "string" },
    handoff: { type: "boolean" },
    reason: { type: ["string", "null"] },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "The support assistant is not configured." }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Please sign in again." }, 401);

    const { conversationId } = await req.json();
    const admin = createClient(url, service);
    const { data: request } = await admin.from("support_requests")
      .select("id, status, user_id").eq("conversation_id", conversationId).maybeSingle();
    if (!request || request.user_id !== user.id) return json({ error: "Support chat not found." }, 404);
    if (request.status !== "bot") return json({ skipped: true, status: request.status });

    const { data: history } = await admin.from("messages")
      .select("sender_kind, content, type").eq("conversation_id", conversationId)
      .order("created_at", { ascending: false }).limit(20);
    const input = (history ?? []).reverse()
      .filter((m) => m.type === "text" && (m.sender_kind === "user" || m.sender_kind === "bot"))
      .map((m) => ({ role: m.sender_kind === "bot" ? "assistant" : "user", content: m.content }));

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: INSTRUCTIONS,
        input,
        text: { format: { type: "json_schema", name: "support_reply", strict: true, schema } },
      }),
    });

    if (!aiRes.ok || !aiRes.body) {
      const detail = await aiRes.text().catch(() => "");
      console.error("AI gateway error", aiRes.status, detail);
      const message = aiRes.status === 429 ? "The assistant is busy right now. Try again in a moment, or tap Talk to a person."
        : aiRes.status === 402 ? "The assistant is out of AI credits. Tap Talk to a person to reach an admin."
        : "The assistant couldn't answer. Tap Talk to a person to reach an admin.";
      return json({ error: message }, aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 502);
    }

    // Consume the SSE stream and collect the final text.
    const reader = aiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === "response.output_text.delta") text += evt.delta ?? "";
        } catch { /* partial line */ }
      }
    }

    let parsed: { reply: string; handoff: boolean; reason: string | null };
    try { parsed = JSON.parse(text); } catch { parsed = { reply: text || "Sorry, I didn't catch that.", handoff: false, reason: null }; }

    await admin.from("messages").insert({ conversation_id: conversationId, sender_kind: "bot", content: parsed.reply || "…" });
    if (parsed.handoff) {
      await admin.from("support_requests").update({ status: "waiting", waiting_since: new Date().toISOString(), reason: parsed.reason })
        .eq("id", request.id).eq("status", "bot");
      await admin.from("messages").insert({ conversation_id: conversationId, sender_kind: "system", content: "You're in the queue. A live admin will join this chat shortly." });
    }
    return json({ ok: true, handoff: parsed.handoff });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong with the assistant." }, 500);
  }
});
