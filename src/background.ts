async function transcribeChunk(
  base64Audio: string,
  mimeType = "audio/webm",
  prompt = "",
) {
  // Dev mode: return mock transcription without any network requests
  if (await isDevMode()) {
    const mockAudioSeconds = 15 + Math.random() * 30;
    updateUsageStats({ elevenlabsSeconds: mockAudioSeconds }).catch(() => {});
    console.log("[LateMeet][DEV] Mock transcription returned");
    return getMockTranscription();
  }

  // Use ElevenLabs API key if available, fallback to OpenAI if not
  const elevenlabsKey = await chrome.storage.local
    .get("elevenlabs_api_key")
    .then((r) => r.elevenlabs_api_key);

  const bytes = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });

  if (!isChunkViable(blob)) {
    console.warn(
      "[LateMeet] Audio chunk too small to transcribe, skipping:",
      blob.size,
      "bytes",
    );
    return null;
  }

  // ---------------- ELEVENLABS STT ----------------
  if (elevenlabsKey) {
    try {
      const normalizedMime = mimeType.split(";")[0].trim();
      const extension = audioFileExtensionForMimeType(normalizedMime);

      const formData = new FormData();
      formData.append("file", blob, `audio.${extension}`);
      formData.append("model_id", ELEVENLABS_STT_MODEL);

      const response = await fetch(
        "https://api.elevenlabs.io/v1/speech-to-text",
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenlabsKey,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const text = await response.text();
        console.error("[LateMeet] ElevenLabs API error", text);
        throw new Error(`ElevenLabs STT error ${response.status}`);
      }

      const data = await response.json();

      const estimatedSeconds = blob.size / 16000;
      updateUsageStats({ elevenlabsSeconds: estimatedSeconds }).catch(() => {});

      const transcript = (data.text || "").trim();
      if (!transcript) throw new Error("Empty transcript");

      return transcript;
    } catch (err) {
      console.warn(
        "[LateMeet] ElevenLabs failed, falling back to Whisper:",
        err,
      );
    }
  }

  // ---------------- WHISPER FALLBACK ----------------
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  const normalizedMime = mimeType.split(";")[0].trim();
  const extension = audioFileExtensionForMimeType(normalizedMime);

  const formData = new FormData();
  formData.append("file", blob, `audio.${extension}`);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");

  if (prompt) {
    formData.append("prompt", prompt);
  }

  const response = await fetch(OPENAI_WHISPER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Whisper error ${response.status}: ${text}`);
  }

  const data = await response.json();

  if (typeof data.duration === "number") {
    updateUsageStats({ whisperSeconds: data.duration }).catch(() => {});
  }

  return (data.text || "").trim();
}