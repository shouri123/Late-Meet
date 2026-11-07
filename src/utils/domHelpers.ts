import { describe, it } from 'node:test';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { escapeHtml, sanitizeTopicStatus } from './domHelpers';

describe('Fuzz Tests - DOM Helpers', () => {
  
  describe('escapeHtml() - XSS Prevention', () => {
    
    it('should never contain raw HTML special characters', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const escaped = escapeHtml(input);
          assert(!escaped.includes('<'));
          assert(!escaped.includes('>'));
          return true;
        })
      );
    });

    it('should escape XSS injection attempts', () => {
      const xssVectors = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert("xss")',
      ];
      for (const vector of xssVectors) {
        const escaped = escapeHtml(vector);
        assert(!escaped.includes('<'));
        assert(!escaped.includes('>'));
      }
    });
  });

  describe('sanitizeTopicStatus()', () => {
    
    it('should always return valid status', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = sanitizeTopicStatus(input);
          const valid = ['active', 'completed', 'unresolved'];
          assert(valid.includes(result));
          return true;
        })
      );
    });

    it('should return "active" for invalid inputs', () => {
      const invalid = ['', '   ', 'invalid', 'pending', null, undefined];
      for (const input of invalid) {
        const result = sanitizeTopicStatus(input);
        assert.strictEqual(result, 'active');
      }
    });
  });
});
