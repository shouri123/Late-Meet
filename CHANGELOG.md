# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0](https://github.com/shouri123/Late-Meet/compare/late-meet-v1.1.0...late-meet-v1.2.0) (2026-06-29)


### 🚀 Features

* Add API endpoint URL validation to enforce HTTPS-only connections ([211dcd1](https://github.com/shouri123/Late-Meet/commit/211dcd13cc34c5081f5aea81be64105ef0031b29))
* add bundle size budget checker with 1MB warning on PR builds ([134e176](https://github.com/shouri123/Late-Meet/commit/134e176c7fefa083119e3ccbc003a514a27a9792))
* add bundle size budget checker with 1MB warning on PR builds ([5902540](https://github.com/shouri123/Late-Meet/commit/5902540c74b4a10ce6a703d87b6d6f321bc217e9))
* add configurable summarization interval ([eed5d5e](https://github.com/shouri123/Late-Meet/commit/eed5d5ed112240444da535d27568b95634480488))
* add configurable summarization interval ([a024773](https://github.com/shouri123/Late-Meet/commit/a024773cca9f6817de832374bed8b19bc318246b))
* add copy transcripts to clipboard ([dd276bc](https://github.com/shouri123/Late-Meet/commit/dd276bccf8a0d40dadd7e959a297ec5f56cf14e4))
* add copy-to-clipboard support for individual transcript entries ([04a3539](https://github.com/shouri123/Late-Meet/commit/04a35399c4a55040912b90984af8ef23c46d27d9))
* add guided onboarding flow for first-time users ([4b0511f](https://github.com/shouri123/Late-Meet/commit/4b0511ff1eef7494d0900be8dc6f17c5f35ced6c))
* add individual copy-to-clipboard buttons for action items and d… ([b94a454](https://github.com/shouri123/Late-Meet/commit/b94a4542f3a917f778fae66e5a37e025a39f03fa))
* add individual copy-to-clipboard buttons for action items and decisions ([1cd022f](https://github.com/shouri123/Late-Meet/commit/1cd022fac5ff18eee4366a71897d2afdfdbaa2ee))
* Add MeetingSession and StorageSchema types for type-safe storage ([6fc2ef1](https://github.com/shouri123/Late-Meet/commit/6fc2ef109977322ce744d3535dd50be8d61a7d36))
* add popup onboarding tooltip tour ([e689c16](https://github.com/shouri123/Late-Meet/commit/e689c16c27aafaf8b3ec277af608a80d967db251))
* add popup onboarding tooltip tour ([509de8b](https://github.com/shouri123/Late-Meet/commit/509de8b29ff5c5d943b2fed3a14b2cededf41cfe))
* bulk PR integration — merge 59+ PRs with unified fixes and quality improvements ([086bc4b](https://github.com/shouri123/Late-Meet/commit/086bc4ba0b858844ae9d5432892d5320653334ae))
* enforce minimum vault passphrase strength with setup feedback ([9168fe5](https://github.com/shouri123/Late-Meet/commit/9168fe57b66e89f2fde3fa6681d257eb507f8113))
* enforce minimum vault passphrase strength with setup feedback ([2b71e89](https://github.com/shouri123/Late-Meet/commit/2b71e89d25b4a53d294af292f70bdd9abcd87b4e))
* implement API cost and token usage dashboard (Fixes [#771](https://github.com/shouri123/Late-Meet/issues/771)) ([76f3837](https://github.com/shouri123/Late-Meet/commit/76f3837661d79e465f60901ce6a4acb7f223a073))
* implement API cost and token usage dashboard (Fixes [#771](https://github.com/shouri123/Late-Meet/issues/771)) ([411e181](https://github.com/shouri123/Late-Meet/commit/411e1816125317cf0cefbf437d392f44e2e66f2c))
* implement robust error handling and retry mechanism ([d658fa0](https://github.com/shouri123/Late-Meet/commit/d658fa01313c9fba53ef8ba5794418ff028b695d))
* implement robust exponential backoff retry for API calls ([8785dc6](https://github.com/shouri123/Late-Meet/commit/8785dc6072c25809a92110e6f4f887a24c392b6e))
* integrate PR features — network resilience, observer fix, settings cleanup, storage management, usage tracker, export/copy buttons, name sanitization, tab state persistence ([1007644](https://github.com/shouri123/Late-Meet/commit/1007644d687f567630666c1a4995d9f86af4d1b9))
* pre-flight check for api keys before recording ([0fdce3b](https://github.com/shouri123/Late-Meet/commit/0fdce3be723fca459073648d2cd73e6f992fdd38))
* **ui:** implement professional empty states design system ([91329dc](https://github.com/shouri123/Late-Meet/commit/91329dc284fdfb51b0c12adcf697c4ae122d4007))


### 🐛 Bug Fixes

* 608 pending chunks memory leak ([9b8d723](https://github.com/shouri123/Late-Meet/commit/9b8d7239349cb1be419da69d6540f7cc02abe482))
* 609 sw restart state corruption ([64fc5a9](https://github.com/shouri123/Late-Meet/commit/64fc5a93cbf3735e7a1a724b59ce955a3069ff48))
* **a11y:** add keyboard focus indicator to range slider ([#721](https://github.com/shouri123/Late-Meet/issues/721)) ([18a8d30](https://github.com/shouri123/Late-Meet/commit/18a8d30b80fa5efb327d18bacac16f6beb58da81))
* **a11y:** add keyboard focus indicator to range slider ([#721](https://github.com/shouri123/Late-Meet/issues/721)) ([255a19d](https://github.com/shouri123/Late-Meet/commit/255a19d0b10deb75bbe4f4ade6d501ce24ec7aab))
* **a11y:** add keyboard focus indicator to theme selector dropdown ([#720](https://github.com/shouri123/Late-Meet/issues/720)) ([24601b1](https://github.com/shouri123/Late-Meet/commit/24601b1ce1b733eeacfe8ef8cd5e976402c63263))
* **a11y:** add keyboard focus indicator to theme selector dropdown (#… ([6bbba02](https://github.com/shouri123/Late-Meet/commit/6bbba021a041977d58633e17587d5913a16b356a))
* **a11y:** add role=dialog, aria-modal and focus management to late-joiner brief overlay ([4fcdab2](https://github.com/shouri123/Late-Meet/commit/4fcdab2f01389da657ea85720cf1d95757b42467))
* **a11y:** add role=dialog, aria-modal, aria-labelledby and focus management to brief overlay ([b7fbb00](https://github.com/shouri123/Late-Meet/commit/b7fbb003925e6256ff2f57e70d7618396e9aebb8)), closes [#740](https://github.com/shouri123/Late-Meet/issues/740)
* **a11y:** use ul/li for topics list to provide proper list semantics ([1ad7f20](https://github.com/shouri123/Late-Meet/commit/1ad7f2060b265dbf2a166e6bfffa6f0b68c3ffdf))
* **a11y:** use ul/li for topics list to provide screen reader list semantics ([a4160bb](https://github.com/shouri123/Late-Meet/commit/a4160bb7fc477cd55ec10e2ea4b46d995969551f)), closes [#742](https://github.com/shouri123/Late-Meet/issues/742)
* add bundle size check script ([ddb38e7](https://github.com/shouri123/Late-Meet/commit/ddb38e77e21875c3c7569e26ba0d8ce035249c79))
* add cancel() and proper types to debounceSpeakerAttribution ([9875b06](https://github.com/shouri123/Late-Meet/commit/9875b06ae14a82102f2d04d7ea23b50b191dc058))
* add cancel() and proper types to debounceSpeakerAttribution ([d4ca3d7](https://github.com/shouri123/Late-Meet/commit/d4ca3d787a471e8fd8a986ba260eacf85608674c))
* add ElevenLabs API key validation before starting audio capture ([0ee76e1](https://github.com/shouri123/Late-Meet/commit/0ee76e1e4ce7a268545ed5ce7c5bc85362e4944a))
* add ElevenLabs API key validation before starting audio capture ([1fa903c](https://github.com/shouri123/Late-Meet/commit/1fa903cc2d7488b72f91c04562576af3f8273766))
* add focus-visible style and tabindex to floating "Start Copilot" button ([3b49f31](https://github.com/shouri123/Late-Meet/commit/3b49f31ca9c2178dda08c2730d695bc30a2912d7))
* add focus-visible style and tabindex to floating Start Copilot button ([ea9ea78](https://github.com/shouri123/Late-Meet/commit/ea9ea7810ae908a95ce1c20f4c55275275639a14))
* add missing DRAIN_TIMEOUT_MS and MAX_PENDING_CHUNKS exports to config.ts ([81d50f9](https://github.com/shouri123/Late-Meet/commit/81d50f944e7230a55b358ac0edc4278b5dca55e1))
* add missing import keyword for offscreenAudioGraph imports in offscreen.ts ([50363a8](https://github.com/shouri123/Late-Meet/commit/50363a8eb86446eedab90f7ac02cb60a2789f653))
* add outline fallback for forced-colors/high-contrast mode ([52d1637](https://github.com/shouri123/Late-Meet/commit/52d1637dc783874bd4c81ff0e3790e2199e94cc8))
* address settings sonar warnings ([2f378d0](https://github.com/shouri123/Late-Meet/commit/2f378d093b804bed050341d02eb41bd473932dbc))
* also constrain space-separated HSL and allow leading zeros in isValidAccent ([c68faf4](https://github.com/shouri123/Late-Meet/commit/c68faf4333e520cc272cefdf19a62a478208b444))
* await final dataavailable and guard recorder restart on flush ([0596576](https://github.com/shouri123/Late-Meet/commit/0596576df15cc6d68f3b2714a57fc7b403d6d512))
* catch storage quota and getBytesInUse errors gracefully ([50fa601](https://github.com/shouri123/Late-Meet/commit/50fa6014de77544c63fb2c3541e69c950792e742))
* catch storage quota and getBytesInUse errors gracefully ([fc11db3](https://github.com/shouri123/Late-Meet/commit/fc11db3b37146d2380e10c72706e05663928d7f4))
* centralize XSS sanitization and add CSP to prevent code execution (fixes [#504](https://github.com/shouri123/Late-Meet/issues/504)) ([be73540](https://github.com/shouri123/Late-Meet/commit/be735409aa00804eba3f06a05596f317bc7e23a2))
* consolidate duplicate beforeunload listeners in content.ts ([#555](https://github.com/shouri123/Late-Meet/issues/555)) ([f3dc082](https://github.com/shouri123/Late-Meet/commit/f3dc082f0e6708cf87fac8a4fb02f9646fe99d1c))
* consolidate duplicate beforeunload listeners in content.ts ([#555](https://github.com/shouri123/Late-Meet/issues/555)) ([7985711](https://github.com/shouri123/Late-Meet/commit/798571183cac88f7ea32bd6a1261ca0a5fbed75f))
* constrain HSL range in isValidAccent to valid CSS values ([150c43b](https://github.com/shouri123/Late-Meet/commit/150c43b2738e25382180f4ceb89d339960163697))
* constrain HSL range in isValidAccent to valid CSS values ([e6516c9](https://github.com/shouri123/Late-Meet/commit/e6516c9918a1de4f6975772043c2d4b6f25774f0))
* convert safeLocalStore to async/await and replace any with unknown ([9b0fd9f](https://github.com/shouri123/Late-Meet/commit/9b0fd9f7b27a8f5dabf84173a2806f13c2399aee))
* correct ElevenLabs API key validation and prevent credential overwrite ([#770](https://github.com/shouri123/Late-Meet/issues/770)) ([bf1c05b](https://github.com/shouri123/Late-Meet/commit/bf1c05bcfc42a8116ccfc09365f5a140fbc756c6))
* correct ElevenLabs API key validation error message and prevent credential overwrite on partial save ([#770](https://github.com/shouri123/Late-Meet/issues/770)) ([1e0d2b5](https://github.com/shouri123/Late-Meet/commit/1e0d2b5d9bfbe2db6fc15a574c178dc75500df2c))
* correct pendingJoiners type and include it in snapshot ([b78323a](https://github.com/shouri123/Late-Meet/commit/b78323a0ebb5abaccd28baf0d0b3ea25c29045ef))
* correct ToC anchor links ([c58b41f](https://github.com/shouri123/Late-Meet/commit/c58b41f4e3728ca0ca3c9c99a99d770691f13038))
* distinguish missing and incorrect onboarding passphrases ([aff2f5d](https://github.com/shouri123/Late-Meet/commit/aff2f5dabc7a7cc96e5929a0a7bcb11519993636))
* eliminate regex for tag stripping, use text-only helper ([a500a41](https://github.com/shouri123/Late-Meet/commit/a500a411f77432eeffc37fffd750f68b8114fa58))
* emit complete WebM files per chunk by restarting recorder on flush ([13d149e](https://github.com/shouri123/Late-Meet/commit/13d149e543d5e3c3ee15f8d001826cd38f3a2d05)), closes [#678](https://github.com/shouri123/Late-Meet/issues/678)
* emit complete WebM files per chunk by restarting recorder on flush ([#678](https://github.com/shouri123/Late-Meet/issues/678)) ([8adfc19](https://github.com/shouri123/Late-Meet/commit/8adfc19892d3094ac5715461dd0be774c0ad061f))
* enforce case-insensitive matching for excluded participant labels ([533dbbb](https://github.com/shouri123/Late-Meet/commit/533dbbbe577cf7dc4693f8df8cb9358c5d1a4c16))
* enforce case-insensitive matching for excluded participant labels ([f5f4460](https://github.com/shouri123/Late-Meet/commit/f5f44606c104ab23f4df709dbb4c93dc01691240))
* enforce passphrase minimum at unlock boundary and add a11y live region ([c41da6d](https://github.com/shouri123/Late-Meet/commit/c41da6d922fdbe2771673fe60ae4658ed7945069))
* enforce safe boundaries for summarizationInterval ([c51b64c](https://github.com/shouri123/Late-Meet/commit/c51b64c8f19fcb169b62a1ac7046135dd6b700be))
* enforce safe boundaries for summarizationInterval ([2f33cbe](https://github.com/shouri123/Late-Meet/commit/2f33cbe5eb554e3417d9ec427230cc88a1af0a78))
* enforce safe range boundaries for vadThreshold ([0ac9d70](https://github.com/shouri123/Late-Meet/commit/0ac9d70f1c0f653ed65ec002aaa58b19449f883e))
* enforce safe range boundaries for vadThreshold ([7402d6f](https://github.com/shouri123/Late-Meet/commit/7402d6f7a3816d3bd34ca17e31075816f080bf37))
* explicitly inject content script styles ([1b37e60](https://github.com/shouri123/Late-Meet/commit/1b37e6032ba0b018b5d8c9f8a943dcb58034d33e))
* explicitly inject content script styles ([2437139](https://github.com/shouri123/Late-Meet/commit/24371396875b7f0a027b0d2ae7ffdd21984a13c6))
* export timeline and transcript with empty fallbacks in Markdown and PlainText ([68761bc](https://github.com/shouri123/Late-Meet/commit/68761bc413f3e949fce0f6687889889494017fd2))
* export timeline and transcript with empty fallbacks in Markdown and PlainText ([f7bc760](https://github.com/shouri123/Late-Meet/commit/f7bc760bd6e74ce2eadeb49671237af110670090))
* guard all console.log calls in background.ts behind DEBUG flag ([57d85f0](https://github.com/shouri123/Late-Meet/commit/57d85f02d1789bb9afa5c0ebadddc6f4c942fd76))
* guard resetState() on missing session instead of audioActive flag ([383a9dc](https://github.com/shouri123/Late-Meet/commit/383a9dc0601dc7bee81802d9bbfb800fdd4f2407))
* guard resetState() on missing session instead of audioActive flag ([7f813af](https://github.com/shouri123/Late-Meet/commit/7f813afbbb0420249c9674f9da8a4ebd9ec4f8b6)), closes [#584](https://github.com/shouri123/Late-Meet/issues/584)
* import shared settings helper ([9d3cc1a](https://github.com/shouri123/Late-Meet/commit/9d3cc1a43830b0669172541cf503c69bd491083c))
* keep safeLocalStore non-throwing ([3baaa7b](https://github.com/shouri123/Late-Meet/commit/3baaa7bd6b0ee642821eff674fbfb1f78dfd56ad))
* keep settings extensible with derived toggle keys ([f1e6aae](https://github.com/shouri123/Late-Meet/commit/f1e6aaef5d29461d8828f1355babf86b35b7e2ad))
* make debug logging build-time gated ([46df73d](https://github.com/shouri123/Late-Meet/commit/46df73ddd92888135a67987ec1e1d4f9957c1581))
* make late-joiner briefings private by default ([d7c8629](https://github.com/shouri123/Late-Meet/commit/d7c8629109d70f78ecee68511b46186a556b44b8))
* make late-joiner briefings private by default ([4d48c5e](https://github.com/shouri123/Late-Meet/commit/4d48c5eb6dd8cea4407ca2778da49629e6b7ae3e))
* Move audio chunk processing to offscreen document to unblock UI ([43b1c53](https://github.com/shouri123/Late-Meet/commit/43b1c53e774a58ca24044b57d09818fa72a2f817))
* move dialog role to card element, add focus trap, guard focus restore with document.contains ([206342f](https://github.com/shouri123/Late-Meet/commit/206342f9d91e0244ea0de2d5d545c97a237e49c3))
* multiple Google Meet tabs participant cross-contamination ([eda91ca](https://github.com/shouri123/Late-Meet/commit/eda91ca4932f6f5270a4633977851106c25025aa))
* MV3 service worker restart silently corrupts active meeting state ([#609](https://github.com/shouri123/Late-Meet/issues/609)) ([bfe98da](https://github.com/shouri123/Late-Meet/commit/bfe98da9971d19d66d166de0bc0f1575955797df))
* narrow State.savedAt type from string|number to number ([64f533b](https://github.com/shouri123/Late-Meet/commit/64f533bbc6cb3ec615097af5fb45e8a6674a0e7e))
* normalize legacy savedAt strings ([2a35d32](https://github.com/shouri123/Late-Meet/commit/2a35d3252fa2441048d044d748e1a9356a62470e))
* offscreen capture shutdown race condition ([71d6279](https://github.com/shouri123/Late-Meet/commit/71d62799d6bc445dfaa05e9a50e5f2bcdbe251d1))
* **onboarding:** correct relative redirect path to options.html ([5951a66](https://github.com/shouri123/Late-Meet/commit/5951a6602307372a095aa99859d38742401695e9))
* **onboarding:** correct relative redirect path to options.html ([3eec55a](https://github.com/shouri123/Late-Meet/commit/3eec55a4ce25d3754aef6d7bff37029f1a2c6612))
* **onboarding:** correct typo shortings to summaries in Quick Start s… ([0f565c2](https://github.com/shouri123/Late-Meet/commit/0f565c20a56aa1e5895fc7ef3f4b04eafc35cc67))
* **onboarding:** correct typo shortings to summaries in Quick Start slide ([bfeca7d](https://github.com/shouri123/Late-Meet/commit/bfeca7d334a69d76249de00c38d1dfcf4673fde5))
* **onboarding:** remove unused err variables in validation catch blocks ([baf89c4](https://github.com/shouri123/Late-Meet/commit/baf89c42e33f58c504d346b4ed6b7db4b6a8d6ae))
* **onboarding:** remove unused err variables in validation catch blocks ([28dfdda](https://github.com/shouri123/Late-Meet/commit/28dfdda8828670559de1546fc85fbce9b9e3bfda))
* propagate storage errors in safeLocalStore instead of swallowing them ([dad3f65](https://github.com/shouri123/Late-Meet/commit/dad3f659c73fa335e18c6f1d9f2be4be6123370c))
* remove [key: string]: any index signature from options.ts Settings interface ([53eef21](https://github.com/shouri123/Late-Meet/commit/53eef2151915bb3b4cf368f1ba7a1ae0ac13afa6))
* remove dead indexedDbCache.ts — exported function never imported anywhere ([d346008](https://github.com/shouri123/Late-Meet/commit/d3460083fb7c18a7276b95b3cedb913f5e681072))
* remove duplicate .options-section selector ([0149596](https://github.com/shouri123/Late-Meet/commit/01495964c330fd50e0ded2d9b874e49cd2bf78d1))
* remove duplicate ID guard in persistMeetingSession causing silen… ([eba9ecc](https://github.com/shouri123/Late-Meet/commit/eba9ecc5cb1c838badc4d8db7e5c4f833b17b192))
* remove redundant role attributes from native ul/li elements ([8b34e9b](https://github.com/shouri123/Late-Meet/commit/8b34e9b57f70a648b565b2a3267f4f9829e5b16f))
* remove unnecessary escape character in sanitize.ts regex ([8acd3e5](https://github.com/shouri123/Late-Meet/commit/8acd3e575495d80067307ecae7400cd744771697))
* remove unused sanitizeDataAttr, fix prettier formatting ([f7ba2f4](https://github.com/shouri123/Late-Meet/commit/f7ba2f41af9bdcec814a05a38e11d7134ebcd620))
* replace Ctrl+Shift+W save-session shortcut that conflicts with Chrome Close Window ([a954073](https://github.com/shouri123/Late-Meet/commit/a954073a37254b50b4d38ac50e99618b1c366929))
* replace native confirm() with inline confirmation pattern in storage dashboard ([8e647ec](https://github.com/shouri123/Late-Meet/commit/8e647ec337d58d6c89706c0d1210ca204a41fc66))
* replace ReDoS-vulnerable regex with safe alternative ([5dbbf87](https://github.com/shouri123/Late-Meet/commit/5dbbf87c5dbf6fed58718df2604c9c53deafd7fe))
* require vault unlock before saving onboarding API keys ([4ee6b7d](https://github.com/shouri123/Late-Meet/commit/4ee6b7d54dd0e0bf5ac5cda814abe0302008c687))
* require vault unlock before saving onboarding API keys ([e9bf438](https://github.com/shouri123/Late-Meet/commit/e9bf43849ed444acd23e7ba8f48a32160743a66e))
* reset dashboard audio button when meeting ends ([95bf1b8](https://github.com/shouri123/Late-Meet/commit/95bf1b837f6dd3d56aae923da6538f33b8153831))
* resolve background service worker offline queue resume and credentials wipe review comments ([fa02dad](https://github.com/shouri123/Late-Meet/commit/fa02dad4d104060f4762ec944402d5a60f050493))
* resolve CI failures - spell, types, and Sonar complexity ([f1b8ba8](https://github.com/shouri123/Late-Meet/commit/f1b8ba8243f27b7462e9a9a43d90d71d9635db28))
* resolve CodeRabbit review comments ([f5c65a4](https://github.com/shouri123/Late-Meet/commit/f5c65a44d5dc313624dd85e8faa5ea1c727d805b))
* resolve extension popup layout clipping across zoom level ([4babb5a](https://github.com/shouri123/Late-Meet/commit/4babb5a056015a685708d634ec65eff11e5503c3))
* resolve outstanding review comments and format code ([3ad3256](https://github.com/shouri123/Late-Meet/commit/3ad3256c21e3cc8acf2c79f21af2960f9768e18d))
* resolve prettier and TypeScript errors ([0ca00b4](https://github.com/shouri123/Late-Meet/commit/0ca00b4cf15a9e05479c93b6031396be037085a7))
* resolve SonarCloud cognitive complexity and object stringification warnings ([a1ba2fe](https://github.com/shouri123/Late-Meet/commit/a1ba2fe31cb4d098fc80cf08107b61898f86aca2))
* resolve SonarCloud warnings and PR [#618](https://github.com/shouri123/Late-Meet/issues/618) reviews ([1e92845](https://github.com/shouri123/Late-Meet/commit/1e9284553325081dd16242ee8aa192ee6164eac4))
* resolve storage dashboard delete handler merge artifact ([60bc89a](https://github.com/shouri123/Late-Meet/commit/60bc89a8ac959768649ce4bceaebfee8d4839f0d))
* resolve syntax error and unused import in offscreen.ts ([6b11e4b](https://github.com/shouri123/Late-Meet/commit/6b11e4bc2e3f378459df4eb0b25ecbe6c3659a54))
* resolve user gesture loss when opening side panel from popup and onboarding ([9fc6b77](https://github.com/shouri123/Late-Meet/commit/9fc6b7729c8d72574b30bc37e1172db0221f36b5))
* resolve user gesture loss when opening side panel from popup and onboarding ([a2d7068](https://github.com/shouri123/Late-Meet/commit/a2d70689fa6ef8b9b9e1c79dbd1404ce8a990964))
* respect dashboard microphone permission ([614d14f](https://github.com/shouri123/Late-Meet/commit/614d14f72a4b67793a71151e333dee38790319e4))
* respect prefers-reduced-motion for UI animations ([e4245cf](https://github.com/shouri123/Late-Meet/commit/e4245cf1c4e29e6e19948ad0544f3258a627cf31))
* revert trufflehog action pin to pass dependency review ([118831d](https://github.com/shouri123/Late-Meet/commit/118831d7ebd70de2c46dd865c6164a7b9ed8f955))
* robust event listener registration in ApiTransactionManager to prevent duplicates ([74db1ac](https://github.com/shouri123/Late-Meet/commit/74db1ac77a8aeaeb47d10b16824a69d984799df9))
* robust event listener registration in ApiTransactionManager to prevent duplicates ([f5b88a3](https://github.com/shouri123/Late-Meet/commit/f5b88a3310b7911427f09fd0e0876324a8d85b7e))
* show actual accent colors in picker swatches as filled circles ([0e5b9cd](https://github.com/shouri123/Late-Meet/commit/0e5b9cdc802a60fce9b9303d04255429c859320d))
* smooth theme transitions and prevent page-load flash in options ([1032ac9](https://github.com/shouri123/Late-Meet/commit/1032ac9525451ce7386b1ebe09986a9f8de2a04f))
* smooth theme transitions and prevent page-load flash in options ([d11bb65](https://github.com/shouri123/Late-Meet/commit/d11bb6540bd1982da15bd666d0f14f81503af857))
* stop session deletion from resurrecting the legacy savedSessions key ([45e38fe](https://github.com/shouri123/Late-Meet/commit/45e38fea905f8b1ab317fe3b236c69ab9a961da4))
* stop session deletion from resurrecting the legacy savedSessions key ([329de7f](https://github.com/shouri123/Late-Meet/commit/329de7f1a90dbd5c81de0edc54ca9d4967b6f220))
* Strengthen Content Security Policy in manifest.json ([bde0cc6](https://github.com/shouri123/Late-Meet/commit/bde0cc612194c5bf3522dba473350fc97ba19246))
* strictly guard live token counters with session ID and start time ([28ba3c2](https://github.com/shouri123/Late-Meet/commit/28ba3c28ef9e4822f34d871895cdd8afaadfcf3f))
* suppress TS warnings on session export functions ([f4ab148](https://github.com/shouri123/Late-Meet/commit/f4ab148eb180e03729be66c32c86a44db99b75b5))
* sync with main and fix formatting ([d497ea7](https://github.com/shouri123/Late-Meet/commit/d497ea7a0a87b7acb9778d54c0fbd53f4b372671))
* **test:** add missing onSuspend mock to fix CI crash ([453b51a](https://github.com/shouri123/Late-Meet/commit/453b51af580141cfc87404a202c89794945a058c))
* throttle all unbounded arrays and bound growth at source ([#621](https://github.com/shouri123/Late-Meet/issues/621)) ([6e98f40](https://github.com/shouri123/Late-Meet/commit/6e98f40b2c72620dd643b780aee7bfa86f1c05ba))
* throttle all unbounded arrays and bound growth at source ([#621](https://github.com/shouri123/Late-Meet/issues/621)) ([f389163](https://github.com/shouri123/Late-Meet/commit/f3891632d5c1ab5db92d4d54a2199727b8b115a5))
* unbounded memory growth from pendingChunks array ([#608](https://github.com/shouri123/Late-Meet/issues/608)) ([98de157](https://github.com/shouri123/Late-Meet/commit/98de157f609d248b41092652e35387a3d07a97a9))
* use full commit SHAs for GitHub Actions ([821e268](https://github.com/shouri123/Late-Meet/commit/821e268eb84b8541317cff2d64041a1e17d74142))
* use nextIndex in pruneSessionsForQuota ([fa3a0de](https://github.com/shouri123/Late-Meet/commit/fa3a0de9bd972c8944d9f4f65878341992a6f5be))
* use nextIndex in pruneSessionsForQuota ([05e2d68](https://github.com/shouri123/Late-Meet/commit/05e2d68966e6e4977a54baac0ed9eb8d9f6988de))
* wire passphrase vault helpers ([8f41912](https://github.com/shouri123/Late-Meet/commit/8f4191281eec522e21a1454d36968fd9eb19bc88))
* wrap chrome.sidePanel.open in a try/catch block ([b64c9d1](https://github.com/shouri123/Late-Meet/commit/b64c9d1a4d1845b5591be1e3a724cea0d2014cb6))
* wrap chrome.sidePanel.open in a try/catch block ([86e3826](https://github.com/shouri123/Late-Meet/commit/86e3826a292961c146fbd6709c36409e56424365))


### ⚡ Performance

* **#484:** reduce waveform sendMessage frequency from 20/s to 10/s ([b379d57](https://github.com/shouri123/Late-Meet/commit/b379d578a1c42185e52e31434b4334e8ca474130))
* add fast-path for WAVEFORM_DATA to avoid service worker hydration ([0ac4043](https://github.com/shouri123/Late-Meet/commit/0ac4043bbb1ba97b21f70abe823ba24ffda5d248))
* reduce storage read query count from O(N) to O(1) in getStorageStats ([d86e582](https://github.com/shouri123/Late-Meet/commit/d86e582da7f8a31770b9571c5e2e883dd4842210))
* reduce storage read query count from O(N) to O(1) in getStorageStats ([890cac1](https://github.com/shouri123/Late-Meet/commit/890cac1bc7f910acc2ece5fdaa5f9a057401050f))
* reduce VAD analyzer CPU with smaller FFT, buffer reuse, and throttling ([b997077](https://github.com/shouri123/Late-Meet/commit/b997077a05634d882edee7eff738b0347aace31e))
* reduce VAD analyzer CPU with smaller FFT, buffer reuse, and throttling ([e43a56b](https://github.com/shouri123/Late-Meet/commit/e43a56bef7b7608348b03e9152d9bc217020a661))


### 📚 Documentation

* add a detailed Troubleshooting & Common Errors section to README.md ([d216444](https://github.com/shouri123/Late-Meet/commit/d2164445b24620ccf5aa6393e318efaaa3c530a8))
* Add API key and extension-specific security guidelines to SECURITY.md ([61f4583](https://github.com/shouri123/Late-Meet/commit/61f45835ffd03448a04da4e60fbebda656951cd4))
* Add Chrome extension development guidelines to CONTRIBUTING.md ([89b8fe5](https://github.com/shouri123/Late-Meet/commit/89b8fe50e5ede1a303af8c8fbab49329eca6972b))
* add detailed troubleshooting and common errors section to README ([c16ad96](https://github.com/shouri123/Late-Meet/commit/c16ad965a7e5ea33b8904bfb6be9a0fa8c4727cb))
* add inline JSDoc to all utility functions in src/utils ([cc1d121](https://github.com/shouri123/Late-Meet/commit/cc1d1211cfbd85c3d75cc8fd64efc5acdb1ec153))
* add inline JSDoc to all utility functions in src/utils ([c0d9fb0](https://github.com/shouri123/Late-Meet/commit/c0d9fb0954c9582b63801c7c8bbba073a81790c4))
* add JSDoc docstrings to domHelpers.ts utility functions ([2fc9b38](https://github.com/shouri123/Late-Meet/commit/2fc9b38c875bcba84980e1ada34bb14cbd9b3317))
* add JSDoc docstrings to sessionStorage.ts and types.ts ([2051204](https://github.com/shouri123/Late-Meet/commit/2051204db51066d5c6377086ec86ee2eac04fa72))
* add JSDoc docstrings to sessionStorage.ts exported functions ([dca7580](https://github.com/shouri123/Late-Meet/commit/dca75802f75bc561135a1f3117052496a67026fd))
* add JSDoc to all exported constants in config.ts ([ae81f45](https://github.com/shouri123/Late-Meet/commit/ae81f45f19ecd31def28823988adc6daa1b3f5eb))
* add JSDoc to exported constants in config.ts ([3d2f0d1](https://github.com/shouri123/Late-Meet/commit/3d2f0d12383a114d69bce28f83cebf3afd510409))
* add JSDoc to types and functions in options.ts ([40ee02f](https://github.com/shouri123/Late-Meet/commit/40ee02f6ce1b3021aeec72d74ec47b27338eb8ff))
* add prompt template guide ([e290008](https://github.com/shouri123/Late-Meet/commit/e290008a2541653a4bd1f60640e3ad106d227d23))
* add prompt template guide ([5c95072](https://github.com/shouri123/Late-Meet/commit/5c95072efe47cac6524b1895b01c0f49c8c38dde))
* add readme toc ([23b35e0](https://github.com/shouri123/Late-Meet/commit/23b35e0f5a68fed638e45c938f051336d4f9839b))
* add table of contents to readme ([4b43e05](https://github.com/shouri123/Late-Meet/commit/4b43e05df47cbae57ff9ef5cabfdc0a3dbeb630d))
* add table of contents to README ([1a089a8](https://github.com/shouri123/Late-Meet/commit/1a089a8fada98644ba5f1a17340fb95c5d102dcf))
* add table of contents to README ([bfbc504](https://github.com/shouri123/Late-Meet/commit/bfbc504b1bbe5d05fd471e6daf95fe28e391bb2b))
* add troubleshooting section to FAQ.md ([35c28d6](https://github.com/shouri123/Late-Meet/commit/35c28d6bda6c2b78d26f8a230f494f72d358d897))
* add troubleshooting section to FAQ.md ([72f99c2](https://github.com/shouri123/Late-Meet/commit/72f99c2ee26200ff3e27854523c7bb693ec21971))
* Add troubleshooting table and keyboard shortcuts section to README ([ae6ef8f](https://github.com/shouri123/Late-Meet/commit/ae6ef8f42c699d981d9281ec942c21eefb14b0cc))
* add updated table of contents ([0714f43](https://github.com/shouri123/Late-Meet/commit/0714f436fdc33f3132f2c6a1fc70b58f687bf8e1))
* auto-update open issues by difficulty table ([d85e781](https://github.com/shouri123/Late-Meet/commit/d85e781fe0b27251b31710495be2b0714e979327))
* auto-update open issues by difficulty table ([e9adb08](https://github.com/shouri123/Late-Meet/commit/e9adb08388c223f3616f838f3102be5435b9054e))
* auto-update open issues by difficulty table ([e368a41](https://github.com/shouri123/Late-Meet/commit/e368a412aeb038fa58976a7013534077de3074db))
* auto-update open issues by difficulty table ([10d041c](https://github.com/shouri123/Late-Meet/commit/10d041c165ee40a30849e9ca43944f6a11a59669))
* auto-update open issues by difficulty table ([db2f2af](https://github.com/shouri123/Late-Meet/commit/db2f2afdb16b68e0ba369d79f2bb0810cb363481))
* auto-update open issues by difficulty table ([98b96cc](https://github.com/shouri123/Late-Meet/commit/98b96cc170eeae52848c0b378cfc9b82061b0637))
* auto-update open issues by difficulty table ([ca3cebd](https://github.com/shouri123/Late-Meet/commit/ca3cebdb4f7efaaf3115f59492386cf9064f678f))
* auto-update open issues by difficulty table ([b59f497](https://github.com/shouri123/Late-Meet/commit/b59f497c0c477833d60672372ac6bec8a087579f))
* auto-update open issues by difficulty table ([379f0ef](https://github.com/shouri123/Late-Meet/commit/379f0ef155e4d2aaea6eaf9ef596d212e1d5713a))
* auto-update open issues by difficulty table ([8f695b1](https://github.com/shouri123/Late-Meet/commit/8f695b1f5a5ed60164dfa02bebf7482378e28606))
* auto-update open issues by difficulty table ([bdf5f00](https://github.com/shouri123/Late-Meet/commit/bdf5f0040f702c366b9ea7644f79f0f3b223c257))
* auto-update open issues by difficulty table ([1e30337](https://github.com/shouri123/Late-Meet/commit/1e303371557a2ec31fde9ae914efc8dee3a326a3))
* auto-update open issues by difficulty table ([fcda96a](https://github.com/shouri123/Late-Meet/commit/fcda96a2aa2c600dfe9f490603876ce7d387851a))
* auto-update open issues by difficulty table ([116ef9f](https://github.com/shouri123/Late-Meet/commit/116ef9fd921316867cf9c749690721574609b25e))
* auto-update open issues by difficulty table ([c764387](https://github.com/shouri123/Late-Meet/commit/c764387ab26aca7c79d7a6bc8c37d4d810e8cbec))
* auto-update open issues by difficulty table ([e3818db](https://github.com/shouri123/Late-Meet/commit/e3818dba5c238d56c5034065591bc755ba7770d1))
* auto-update open issues by difficulty table ([b71779d](https://github.com/shouri123/Late-Meet/commit/b71779d5b323621ac8fee93c1a73fe5cd45645f9))
* auto-update open issues by difficulty table ([9d4cea0](https://github.com/shouri123/Late-Meet/commit/9d4cea07e8f6b0f95d2e37f21f251185e6088bea))
* auto-update open issues by difficulty table ([e4e78e0](https://github.com/shouri123/Late-Meet/commit/e4e78e0e74a360b130d4a2dfd55dfdb19a451566))
* auto-update open issues by difficulty table ([72a6c42](https://github.com/shouri123/Late-Meet/commit/72a6c424c32b8bfd574fdafdcc782ea0aabb8977))
* auto-update open issues by difficulty table ([ae434bb](https://github.com/shouri123/Late-Meet/commit/ae434bbefbcedcf16ac917b3a29cd33eb13c6b08))
* auto-update open issues by difficulty table ([92ab74c](https://github.com/shouri123/Late-Meet/commit/92ab74c3dfbc1efd0d214ce0e77ddf5f67ae1e54))
* auto-update open issues by difficulty table ([1e01aaf](https://github.com/shouri123/Late-Meet/commit/1e01aaf5a105ff4307384313642d3ef38653c561))
* auto-update open issues by difficulty table ([754c6ff](https://github.com/shouri123/Late-Meet/commit/754c6ff1b9096909859cddea2cdd8531da231d66))
* auto-update open issues by difficulty table ([221f484](https://github.com/shouri123/Late-Meet/commit/221f48464f2373ffc929c81be9d921c9ea521f7b))
* fix prettier formatting in README ([eab4b37](https://github.com/shouri123/Late-Meet/commit/eab4b372a80249de29f5953cc172923a73692c2e))
* fix punctuation in FAQ introduction ([623b799](https://github.com/shouri123/Late-Meet/commit/623b799e3c22f6525de92d2db3754bb7fe5331b9))
* fix spell check warnings in JSDoc comments ([a877800](https://github.com/shouri123/Late-Meet/commit/a877800b911419731cf86e16cb266ca1184e6809))
* fix Three-stage wording and mark sendChunkToOffscreen as unused ([5a68fa9](https://github.com/shouri123/Late-Meet/commit/5a68fa9cc6a003d2e1954df5d3e3121d42fb5321))
* improve README and contributors section ([a364b4d](https://github.com/shouri123/Late-Meet/commit/a364b4d71c3ee76b2cff919fbeb4a6603011bd67))
* improve README with enhanced UI and contributors section ([caa00de](https://github.com/shouri123/Late-Meet/commit/caa00de79b77c185582964f2d7591f5107e1d9f8))
* note save-session shortcut change ([ec84ade](https://github.com/shouri123/Late-Meet/commit/ec84adec02cb758e126a59bdb8955f852b5b0495))


### 💄 Styles

* apply prettier formatting ([09c776e](https://github.com/shouri123/Late-Meet/commit/09c776e7055194ba2ef22a87daf1ef7027449893))
* apply prettier formatting ([340ce29](https://github.com/shouri123/Late-Meet/commit/340ce29f3d39e88ecbb0f7fd7e6eb749f6c32a18))
* apply prettier formatting ([ad08ebe](https://github.com/shouri123/Late-Meet/commit/ad08ebed97895e9aabee887dec6c3699fe525dce))
* apply prettier formatting ([9897790](https://github.com/shouri123/Late-Meet/commit/9897790e1859f7051a8105d6027d20a01340cc10))
* apply prettier formatting ([7a16df7](https://github.com/shouri123/Late-Meet/commit/7a16df7e501edb49c86e7e7588704e7a617b27d8))
* apply prettier formatting ([0b63cbd](https://github.com/shouri123/Late-Meet/commit/0b63cbdda3e9eb8365f8999ba9a0fae6ee1120bf))
* apply prettier formatting ([4b6b3a2](https://github.com/shouri123/Late-Meet/commit/4b6b3a2ba17018f35805d0847299f30f72367bb8))
* fix code formatting ([254a53f](https://github.com/shouri123/Late-Meet/commit/254a53f6efcb82cd42a365ad1232fb6e1d03ce7f))
* fix hover accent border and remove redundant media query ([23fa014](https://github.com/shouri123/Late-Meet/commit/23fa014bad64685198bce83799630f04f0a7ba5a))
* fix indentation in credentialsToSave block ([e3d81e1](https://github.com/shouri123/Late-Meet/commit/e3d81e1627eebbe4b514a1dbf589a818e929a74a))
* fix prettier formatting issues ([2179460](https://github.com/shouri123/Late-Meet/commit/2179460680222da7af6508c07768d4be398cd2d9))
* fix README.md formatting with Prettier ([8c9a719](https://github.com/shouri123/Late-Meet/commit/8c9a7197e2e048478b13d1887f3df3de7a65749e))
* format popup tour handlers ([d2555d4](https://github.com/shouri123/Late-Meet/commit/d2555d470ed284cc5d219c4583bb82e124f8f9bb))
* format prompt template guide ([b5ebfcb](https://github.com/shouri123/Late-Meet/commit/b5ebfcbb7aaf0b244d7e548723ea0dadfac555bd))
* implement responsive sidebar layout for dashboard panel ([f4875c8](https://github.com/shouri123/Late-Meet/commit/f4875c847bfeaa9a28701bdc7d0423d3daa76a51))
* implement responsive sidebar layout for dashboard panel ([ad41acb](https://github.com/shouri123/Late-Meet/commit/ad41acb5b100607ab3146dbdb83b9497a817e011))
* make accent colors visible by default without hover interaction ([80fbbfa](https://github.com/shouri123/Late-Meet/commit/80fbbfaab4dc01e6d5152450a8eeb93cf26a9aad))
* modernize settings options page with CSS grid and hover transi… ([1d4d8d6](https://github.com/shouri123/Late-Meet/commit/1d4d8d62805b34da86247bc9e72550202d211af4))
* modernize settings options page with CSS grid and hover transitions ([f103941](https://github.com/shouri123/Late-Meet/commit/f103941400b9f11ab0db9d56d06bb5c433567472))


### ♻️ Refactors

* address SonarCloud findings in brief overlay focus trap ([e10a7b6](https://github.com/shouri123/Late-Meet/commit/e10a7b6cb3b7f271dd7ca9b7e4db580128ae4128))
* address SonarCloud findings on passphrase strength UI ([b4a9a13](https://github.com/shouri123/Late-Meet/commit/b4a9a138d062b547cfd0e7f6df4ae5a25f372dd2))
* consolidate duplicate getSettings functions ([30641da](https://github.com/shouri123/Late-Meet/commit/30641da5c129890e8f551c9f8488ca87405cebd3))
* consolidate duplicate getSettings functions ([e278680](https://github.com/shouri123/Late-Meet/commit/e2786803c7a9c6c161fd422f96ecf000e633f7cd))
* consolidate getSettings into a shared settings module ([e7fa252](https://github.com/shouri123/Late-Meet/commit/e7fa2525175f05b4841024e71c731c602bfaa434))
* consolidate getSettings into a shared settings module ([07ce6d1](https://github.com/shouri123/Late-Meet/commit/07ce6d11e21d89d2bc33edc0b156f7ee3bedaf4e))
* extract escapeHtml, formatDuration, sanitizeTopicStatus to shared utils/domHelpers.ts ([72f40cd](https://github.com/shouri123/Late-Meet/commit/72f40cda7786284d7a8b303aa8a0efc0b31a7714))
* make escapeHtml DOM independent ([b29fb57](https://github.com/shouri123/Late-Meet/commit/b29fb57002800bdc2f2a5eef6b2f90222d1c1492))
* reduce cognitive complexity and nesting depth to fix SonarCloud ([4ecf210](https://github.com/shouri123/Late-Meet/commit/4ecf210530120c947293e1e79c55feeca564bdcb))
* simplify isValidAccent HSL validation to fix SonarQube maintainability ([5a02073](https://github.com/shouri123/Late-Meet/commit/5a02073a1e4cf6e399b9dc696ac500834bf32e3c))


### ✅ Tests

* add high-volume stress tests for audio chunk queue ([935ae83](https://github.com/shouri123/Late-Meet/commit/935ae837bc26ae68ec24654e78ccfbde5fae1516))
* add high-volume stress tests for the audio chunk queue ([73b10ae](https://github.com/shouri123/Late-Meet/commit/73b10aef144335d0a7b87318b021cbf364243bd2))
* add high-volume stress tests for the audio chunk queue ([a639c85](https://github.com/shouri123/Late-Meet/commit/a639c85d82f4a0b6ffcb923fcfcda2164dac20ab))
* add integration tests for service worker state recovery ([b07e69e](https://github.com/shouri123/Late-Meet/commit/b07e69e63ecfcdebf05e01c0042754b40084345e))
* add integration tests for service worker state recovery ([ccd97c3](https://github.com/shouri123/Late-Meet/commit/ccd97c3f0fad7a793e7de7006b1d58f3ecf220a3))
* add unit tests for sanitization utilities and fix event loop leak in credentials test ([a7facd2](https://github.com/shouri123/Late-Meet/commit/a7facd223f8752eb5e45c2b039a9b879826321bb))
* **audio:** cover offscreen Web Audio graph routing ([4935452](https://github.com/shouri123/Late-Meet/commit/49354529c1615bb5378516e2a2cecedb6c9e8d62))
* **audio:** cover offscreen Web Audio graph routing ([11351d5](https://github.com/shouri123/Late-Meet/commit/11351d5a909d796779be25de7d72b15bb34c3478))
* **audio:** track Web Audio node factory calls ([57b359e](https://github.com/shouri123/Late-Meet/commit/57b359e776aacdc9e1f6ad09be698ba3f499b634))
* dedupe chrome mock and remove nested ternary for SonarCloud ([2bf0c63](https://github.com/shouri123/Late-Meet/commit/2bf0c634c502bb1518c7e0d08a0541a1bb7e64e1))
* fix ordering dependency by consolidating late-joiner tests into one sequential integration test ([df7856b](https://github.com/shouri123/Late-Meet/commit/df7856b0cd5dfb9387bf334f8d781fbf1d108b53))
* fix test suite issues, config env, and credentials mocks ([d366762](https://github.com/shouri123/Late-Meet/commit/d36676222716b475e460a0b86e8cf0cdfed4831d))

## [1.0.0] - 2025-05-13

### Added

- Native Google Meet integration via Chrome `tabCapture` API — no bot participants.
- Real-time audio capture using Offscreen Documents and `MediaRecorder` API.
- ElevenLabs Scribe v2 integration for high-fidelity, multilingual transcription.
- OpenAI Whisper fallback for transcription when ElevenLabs is unavailable.
- OpenAI GPT-powered summarization with rolling context window.
- Late-joiner detection with automated private briefing overlays.
- Host-first (1+N) participant tracking for accurate reporting.
- Side panel dashboard with live summary, topics, decisions, action items, and sentiment analysis.
- Premium monochrome UI with glassmorphism effects and smooth animations.
- BYOK (Bring Your Own Key) model — users provide their own API keys.
- Options page for API key configuration (ElevenLabs + OpenAI).
- Local-first storage using `chrome.storage.local` — no external databases.
- Session save/discard workflow — nothing persists without user consent.
- Manifest V3 compliant architecture with TypeScript and Vite 5 build system.

### Removed

- All Supabase/backend dependencies (migrated to fully local architecture).

### Security

- No telemetry, no analytics, no user tracking.
- API keys stored only in local browser storage.
- No data transmitted to any server other than user-configured API endpoints.
