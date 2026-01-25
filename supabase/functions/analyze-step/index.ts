import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, transcript } = await req.json();

    if (!title) {
      throw new Error("Title is required");
    }

    const prompt = `
      You are an airline safety inspector. Analyze the following preflight inspection task and the inspector's notes.
      Deduce the severity level of any issues found.
      
      TASK: "${title}"
      NOTES: "${transcript || "No notes provided"}"
      
      Respond in strict JSON format with two fields:
      - "severity": one of ["low", "medium", "high", "none"]
        - "high": Critical safety issue, flight must be delayed or grounded.
        - "medium": Minor issue found, needs attention soon but safe for this leg.
        - "low": Operational note or trivial finding.
        - "none": Everything is perfectly functional. (Use this if notes say "ok", "good", "checked", etc).
      - "analysis": A brief, one-sentence professional summary of the finding.
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" }
      }),
    });

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
