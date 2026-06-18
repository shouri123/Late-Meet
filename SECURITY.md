# Security Policy for Late-Meet

We take the security of Late-Meet very seriously. If you believe you have found a security vulnerability in this project, please report it to us responsibly using the guidelines below.

---

## 🛡️ Supported Versions

We actively provide security patches for the following versions of Late-Meet:

| Version | Supported |
| :------ | :-------: |
| 1.2.x   |    Yes    |
| < 1.2.0 |    No     |

---

## 📞 Reporting a Vulnerability

Please **do not** open public GitHub issues for security vulnerabilities, as this could expose users to potential risks before a patch is available. Instead, please report vulnerabilities via one of the following secure channels:

1. **GitHub Private Vulnerability Reporting**: Go to the **Security** tab of this repository on GitHub, click **Vulnerability reporting**, and submit a private report.
2. **Email**: Send an email describing the vulnerability to the project maintainers.
   - **Contact Email**: `chakrabortyshouri@gmail.com`

### Please include the following details in your report:

- A detailed description of the vulnerability and the potential impact.
- Step-by-step instructions to reproduce the issue (including proof-of-concept scripts or screenshots if applicable).
- Details of your testing environment (e.g. Chrome browser version, OS version).

---

## ⏱️ Our Disclosure Policy

We follow a Coordinated Vulnerability Disclosure (CVD) process:

- **Initial Response**: We will acknowledge receipt of your report within **48 hours** and provide an initial assessment.
- **Resolution**: We aim to resolve and release a patch for all verified high-severity vulnerabilities within **30 days** of receipt.
- **Public Disclosure**: Once a fix is released, we will coordinate public disclosure of the vulnerability with you, giving you full credit for the discovery unless you choose to remain anonymous.

Thank you for helping keep Late-Meet secure!

## Chrome Extension Security Guidelines

### API Key Handling

- **Never** commit API keys to the repository
- API keys should be stored in `chrome.storage.local` only
- Rotate any accidentally exposed API keys immediately
- Keys should be treated like passwords — never share them

### Extension-Specific Threats

| Threat                       | Mitigation                              |
| ---------------------------- | --------------------------------------- |
| XSS in extension pages       | Strict CSP in manifest.json             |
| API key theft                | Encrypted storage, local-only sync      |
| Malicious website access     | Declare minimal permissions in manifest |
| Storage corruption           | Schema validation on load               |
| MITM transcript interception | HTTPS-only API endpoints                |

### Permissions Principle

The extension should request minimal permissions:

- Only `activeTab` when possible instead of broad `tabs`
- Avoid `<all_urls>` host permissions
- Use `scripting` API with specific URL patterns

### Reporting Extension Vulnerabilities

For Chrome extension-specific vulnerabilities:

1. Report privately via GitHub Security Advisories
2. Include the Chrome version and extension version
3. Describe if the vulnerability requires user interaction
4. Note whether the exploit requires a malicious website
