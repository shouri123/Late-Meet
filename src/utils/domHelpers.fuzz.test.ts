import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { escapeHtml, sanitizeTopicStatus } from "./domHelpers.ts";

test("escapeHtml: output never contains raw <, >, \", or ' for any arbitrary string input", () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const result = escapeHtml(input);
      assert.doesNotMatch(
        result,
        /[<>"']/,
        `Dangerous char survived escaping — input: ${JSON.stringify(input)}, output: ${JSON.stringify(result)}`,
      );
    }),
  );
});

test("escapeHtml: every & in output is always the start of a known HTML entity", () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const result = escapeHtml(input);
      assert.doesNotMatch(
        result,
        /&(?!amp;|lt;|gt;|quot;|#039;)/,
        `Bare & found in output — input: ${JSON.stringify(input)}, output: ${JSON.stringify(result)}`,
      );
    }),
  );
});

test("escapeHtml: output length is always >= input length", () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const result = escapeHtml(input);
      assert.ok(
        result.length >= input.length,
        `Output shorter than input — input.length=${input.length}, output.length=${result.length}`,
      );
    }),
  );
});

test("escapeHtml: strings with no HTML special chars are returned unchanged", () => {
  fc.assert(
    fc.property(
      fc.string().filter((s) => !/[&<>"']/.test(s)),
      (safeInput) => {
        assert.strictEqual(
          escapeHtml(safeInput),
          safeInput,
          `Safe input was mutated: ${JSON.stringify(safeInput)}`,
        );
      },
    ),
  );
});

test("escapeHtml: Unicode grapheme strings produce no raw dangerous ASCII chars", () => {
  fc.assert(
    fc.property(fc.string({ unit: "grapheme" }), (input) => {
      const result = escapeHtml(input);
      assert.doesNotMatch(
        result,
        /[<>"']/,
        `Dangerous char in Unicode fuzz output — input: ${JSON.stringify(input)}, output: ${JSON.stringify(result)}`,
      );
    }),
  );
});

test("escapeHtml: null is coerced to empty string", () => {
  assert.strictEqual(escapeHtml(null), "");
});

test("escapeHtml: undefined is coerced to empty string", () => {
  assert.strictEqual(escapeHtml(undefined), "");
});

const XSS_CORPUS: string[] = [
  // Classic tag injection
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "<svg onload=alert(1)>",
  "<iframe src=javascript:alert(1)>",
  "<details open ontoggle=alert(1)>",
  '<a href="javascript:alert(1)">click</a>',
  // Attribute breakout via quote chars
  '"; alert(1); //',
  "'; alert(1); //",
  "<div style='background:url(javascript:alert(1))'>",
  // Context-closing prefixes
  "--><script>alert(1)</script>",
  "]]><script>alert(1)</script>",
  "</title><script>alert(1)</script>",
  // Malformed / obfuscated tags
  "<<SCRIPT>alert(1);//<</SCRIPT>",
  "< script >alert(1)</  script >",
  // Null bytes embedded in tag names
  "<scr\x00ipt>alert(1)</scr\x00ipt>",
  // Unicode escape sequences for < >
  "\u003cscript\u003ealert(1)\u003c/script\u003e",
  // Fullwidth Unicode lookalikes (U+FF1C, U+FF1E)
  "\uFF1Cscript\uFF1Ealert(1)\uFF1C/script\uFF1E",
  // Numeric entity encoding (tests that & is also escaped)
  "&#60;script&#62;alert(1)&#60;/script&#62;",
  // data-chunk-id attribute injection (dashboard.ts:481)
  '" onmouseover="alert(1)',
  "' onmouseover='alert(1)",
  // Protocol handlers in URL fields (s.meetingUrl)
  "javascript:alert(document.cookie)",
  "data:text/html,<script>alert(1)</script>",
];

test("escapeHtml: known XSS corpus produces no raw dangerous chars in output", () => {
  for (const vector of XSS_CORPUS) {
    const result = escapeHtml(vector);
    assert.doesNotMatch(
      result,
      /[<>"']/,
      `XSS vector still contains dangerous char after escaping:\n  input:  ${JSON.stringify(vector)}\n  output: ${JSON.stringify(result)}`,
    );
    assert.doesNotMatch(
      result,
      /&(?!amp;|lt;|gt;|quot;|#039;)/,
      `XSS vector produced a bare & after escaping:\n  input:  ${JSON.stringify(vector)}\n  output: ${JSON.stringify(result)}`,
    );
  }
});

const VALID_TOPIC_STATUSES = new Set<string>(["active", "completed", "unresolved"]);

test("sanitizeTopicStatus: output is always exactly one of 'active' | 'completed' | 'unresolved' for any arbitrary string input", () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const result = sanitizeTopicStatus(input);
      assert.ok(
        VALID_TOPIC_STATUSES.has(result),
        `Unexpected status value — input: ${JSON.stringify(input)}, output: ${JSON.stringify(result)}`,
      );
    }),
  );
});

test("sanitizeTopicStatus: valid statuses pass through unchanged", () => {
  assert.strictEqual(sanitizeTopicStatus("active"), "active");
  assert.strictEqual(sanitizeTopicStatus("completed"), "completed");
  assert.strictEqual(sanitizeTopicStatus("unresolved"), "unresolved");
});

test("sanitizeTopicStatus: any input that is not 'completed' or 'unresolved' defaults to 'active'", () => {
  fc.assert(
    fc.property(
      fc.string().filter((s) => s !== "completed" && s !== "unresolved"),
      (input) => {
        // Note: "active" itself hits this branch and produces "active" — correct.
        assert.strictEqual(
          sanitizeTopicStatus(input),
          "active",
          `Expected 'active' fallback — input: ${JSON.stringify(input)}, got: ${JSON.stringify(sanitizeTopicStatus(input))}`,
        );
      },
    ),
  );
});
