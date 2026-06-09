import test from "node:test";
import assert from "node:assert/strict";
import { signBackup, verifyBackup } from "./backupSignature.ts";

test("signBackup returns a 64-character lowercase hex string", async () => {
  const sig = await signBackup({ meetingId: "abc" });
  assert.match(sig, /^[0-9a-f]{64}$/);
});

test("verifyBackup: valid roundtrip passes", async () => {
  const payload = { meetingId: "abc", summary: "test" };
  const sig = await signBackup(payload);
  assert.ok(await verifyBackup({ ...payload, __signature: sig }));
});

test("verifyBackup: missing __signature returns false", async () => {
  assert.ok(!(await verifyBackup({ meetingId: "abc" })));
});

test("verifyBackup: non-string __signature returns false", async () => {
  assert.ok(!(await verifyBackup({ meetingId: "abc", __signature: 99999 })));
});

test("verifyBackup: tampered field fails", async () => {
  const payload = { meetingId: "abc", summary: "original" };
  const sig = await signBackup(payload);
  assert.ok(!(await verifyBackup({ ...payload, summary: "hacked", __signature: sig })));
});

test("verifyBackup: injected extra field fails", async () => {
  const payload = { meetingId: "abc" };
  const sig = await signBackup(payload);
  assert.ok(!(await verifyBackup({ ...payload, injected: true, __signature: sig })));
});

test("verifyBackup: different payloads produce different signatures", async () => {
  const s1 = await signBackup({ a: 1 });
  const s2 = await signBackup({ a: 2 });
  assert.notEqual(s1, s2);
});

test("verifyBackup: empty payload roundtrip passes", async () => {
  const sig = await signBackup({});
  assert.ok(await verifyBackup({ __signature: sig }));
});
