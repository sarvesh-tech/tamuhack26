import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const { title, transcript } = await req.json();
    
    console.log('[analyze-step] ===== FUNCTION INVOKED =====');
    console.log('[analyze-step] Received title:', title);
    console.log('[analyze-step] Received transcript:', transcript);
    console.log('[analyze-step] OPENAI_API_KEY exists:', !!OPENAI_API_KEY);

    if (!title) {
      throw new Error("Title is required");
    }
    
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const prompt = `
      You are an airline safety inspector. Analyze the following preflight inspection task and the inspector's notes.
      Deduce the severity level of any issues found. BE VERY SENSITIVE to any language suggesting problems, even if mixed with positive statements.
      
      TASK: "${title}"
      NOTES: "${transcript || "No notes provided"}"
      
      Respond in strict JSON format with two fields:
      - "severity": one of ["low", "medium", "high", "none"]
        - "high": ANY mention of death, danger, missing equipment, broken items, failure, critical problems, sarcasm about safety, or anything that suggests the flight should not depart. Examples: "people are going to die", "extinguisher missing", "door won't seal", "hydraulic leak".
        - "medium": Concerns, hesitations, incomplete checks, unprofessional notes, or anything suspicious. Examples: "not sure", "might be an issue", "hello" as a note (inappropriate), "I guess it's fine".
        - "low": Minor observations, trivial notes, or routine findings with no safety concern.
        - "none": ONLY use if the notes explicitly confirm everything is correct with positive language like "checked", "verified", "good", "all clear", "operational", "armed correctly".
      - "analysis": A brief, one-sentence professional summary. If there's a problem, describe it clearly.
      
      IMPORTANT: If ANY part of the notes suggests a problem or concern, classify it as at least "medium". Do NOT default to "none" or "low" when there are red flags.
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
    console.log('[analyze-step] OpenAI raw response:', JSON.stringify(data, null, 2));
    
    const result = JSON.parse(data.choices[0].message.content);
    console.log('[analyze-step] Parsed result:', JSON.stringify(result, null, 2));
    console.log('[analyze-step] ===== FUNCTION COMPLETE =====');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('[analyze-step] ERROR:', error);
    console.error('[analyze-step] Error message:', error.message);
    console.error('[analyze-step] Error stack:', error.stack);
    
    const errorDetails = {
      error: error.message,
      stack: error.stack,
      name: error.name
    };
    
    return new Response(JSON.stringify(errorDetails), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
