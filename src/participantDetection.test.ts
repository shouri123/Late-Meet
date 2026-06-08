import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_PARTICIPANT_NAME_LEN,
  collectParticipantNames,
  participantNameFromCandidate,
} from "./participantDetection.ts";

test("participant aria labels are converted into participant names", () => {
  assert.equal(
    participantNameFromCandidate({ ariaLabel: "Participant: Ada Lovelace" }),
    "Ada Lovelace",
  );
  assert.equal(
    participantNameFromCandidate({
      ariaLabel: "Participant: Ada Lovelace",
      text: "Mute More options Pin",
    }),
    "Ada Lovelace",
  );
});

test("tile control aria labels are not treated as participant names", () => {
  assert.equal(participantNameFromCandidate({ ariaLabel: "Mute" }), null);
  assert.equal(participantNameFromCandidate({ ariaLabel: "More options" }), null);
  assert.equal(participantNameFromCandidate({ ariaLabel: "Camera off" }), null);
  assert.equal(participantNameFromCandidate({ ariaLabel: "Pin" }), null);
});

test("participant collection ignores duplicate and control candidates", () => {
  assert.deepEqual(
    collectParticipantNames([
      { ariaLabel: "Participant: You" },
      { text: "Grace Hopper" },
      { ariaLabel: "Mute" },
      { ariaLabel: "More options" },
      { ariaLabel: "Participant: Grace Hopper" },
      { selfName: "Katherine Johnson" },
    ]),
    ["Grace Hopper", "Katherine Johnson"],
  );
});

test("participant collection uses You only as a fallback", () => {
  assert.deepEqual(collectParticipantNames([{ selfName: "Ada Lovelace" }]), ["Ada Lovelace"]);
  assert.deepEqual(collectParticipantNames([]), ["You"]);
});

test("participant name length allows exact max", () => {
  const exact = "a".repeat(MAX_PARTICIPANT_NAME_LEN);
  const tooLong = "a".repeat(MAX_PARTICIPANT_NAME_LEN + 1);

  assert.equal(participantNameFromCandidate({ text: exact }), exact);
  assert.equal(participantNameFromCandidate({ text: tooLong }), null);
});

test("participant names with ellipsis are ignored", () => {
  assert.equal(participantNameFromCandidate({ text: "Ada…" }), null);
  assert.equal(participantNameFromCandidate({ text: "Ada … Lovelace" }), null);
});

test("selfName is preferred over other text sources", () => {
  assert.equal(
    participantNameFromCandidate({
      selfName: "Ada Lovelace",
      text: "Grace Hopper",
      ariaLabel: "Participant: Marie Curie",
    }),
    "Ada Lovelace",
  );
});

test("concatenated text strips control labels", () => {
  assert.equal(
    participantNameFromCandidate({ text: "Ada Lovelace Mute More options Pin" }),
    "Ada Lovelace",
  );
});

test("label stripping handles mute/unmute variants", () => {
  assert.equal(participantNameFromCandidate({ text: "Unmute" }), null);
  assert.equal(participantNameFromCandidate({ text: "Ada Lovelace Unmute" }), "Ada Lovelace");
  assert.equal(participantNameFromCandidate({ text: "Ada Lovelace Muted" }), "Ada Lovelace");
  assert.equal(participantNameFromCandidate({ text: "Ada Lovelace Mute Unmute" }), "Ada Lovelace");
});

test("label stripping tolerates separators and mixed case", () => {
  assert.equal(participantNameFromCandidate({ text: "Ada Lovelace - MUTE" }), "Ada Lovelace");
  assert.equal(participantNameFromCandidate({ text: "Ada Lovelace / unMuTe" }), "Ada Lovelace");
  assert.equal(participantNameFromCandidate({ text: "Muted" }), null);
});

test("label stripping does not remove embedded words", () => {
  assert.equal(participantNameFromCandidate({ text: "Mutee Johnson" }), "Mutee Johnson");
  assert.equal(participantNameFromCandidate({ text: "Unmuteable Ada" }), "Unmuteable Ada");
});

test("case-insensitive control labels are rejected", () => {
  assert.equal(participantNameFromCandidate({ selfName: "you" }), null);
  assert.equal(participantNameFromCandidate({ selfName: "mute" }), null);
  assert.equal(participantNameFromCandidate({ selfName: "Camera Off" }), null);
});
