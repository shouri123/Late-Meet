import test from "node:test";
import assert from "node:assert/strict";
import { checkResponseStatus, ApiError } from "./api.ts";

test("checkResponseStatus returns void for response.ok", async () => {
  const mockResponse = {
    ok: true,
    status: 200,
    text: async () => "OK",
  } as unknown as Response;

  await assert.doesNotReject(async () => {
    await checkResponseStatus(mockResponse, "OpenAI");
  });
});

test("checkResponseStatus throws ApiError with INVALID_KEY for 401 status", async () => {
  const mockResponse = {
    ok: false,
    status: 401,
    text: async () => "Unauthorized",
  } as unknown as Response;

  await assert.rejects(
    async () => {
      await checkResponseStatus(mockResponse, "OpenAI");
    },
    (err: any) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.errorType, "INVALID_KEY");
      assert.equal(err.provider, "OpenAI");
      assert.match(err.message, /Invalid OpenAI API key/);
      return true;
    },
  );
});

test("checkResponseStatus throws ApiError with NO_CREDITS for 429 status", async () => {
  const mockResponse = {
    ok: false,
    status: 429,
    text: async () => "Rate limit reached",
  } as unknown as Response;

  await assert.rejects(
    async () => {
      await checkResponseStatus(mockResponse, "ElevenLabs");
    },
    (err: any) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.errorType, "NO_CREDITS");
      assert.equal(err.provider, "ElevenLabs");
      assert.match(err.message, /ElevenLabs API usage quota/);
      return true;
    },
  );
});

test("checkResponseStatus throws ApiError with GENERIC for other failed status", async () => {
  const mockResponse = {
    ok: false,
    status: 500,
    text: async () => "Internal Server Error",
  } as unknown as Response;

  await assert.rejects(
    async () => {
      await checkResponseStatus(mockResponse, "OpenAI");
    },
    (err: any) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.errorType, "GENERIC");
      assert.equal(err.provider, "OpenAI");
      assert.match(err.message, /OpenAI API error 500: Internal Server Error/);
      return true;
    },
  );
});
