import "./content.css";
import {
  collectParticipantNames,
  participantNameFromCandidate,
  type ParticipantNameCandidate,
} from "./participantDetection.ts";

import { initTheme } from "./theme.js";

initTheme();

(() => {
  const COPILOT_PREFIX = "[LateMeet]";

  const SELECTORS = {
    chatToggleButtons: [
      'button[aria-label*="Chat"]',
      'button[data-panel-id="chat-pane"]',
      'button[jsname][aria-label*="chat"]',
    ],
    chatInput: [
      'textarea[aria-label="Chat text input"]',
      'textarea[name="chatTextInput"]',
      'div[contenteditable="true"][aria-label*="message"]',
      'textarea[placeholder*="message"]',
    ],
    sendButton: [
      'button[aria-label="Send message"]',
      'button[data-tooltip="Send message"]',
      'button[jsname][aria-label*="Send"]',
    ],
    participantNodes: [
      "[data-participant-id] [data-self-name]",
      '[data-participant-id] [role="heading"]',
      '[data-participant-id] span[class="notranslate"]',
      '[data-participant-id][aria-label^="Participant:"]',
      "[data-self-name]", // The tile for the local user
      'div[jsname="NfX98"]', // Common class for names on video tiles
      '[aria-label^="Participant:"]', // Tile aria-labels
    ],
    participantTile: [
      "[data-participant-id]",
      '[aria-label^="Participant:"]',
      "[data-self-name]",
      '[role="listitem"]',
      '[role="gridcell"]',
    ],
    activeSpeakerIndicators: [
      '[aria-label*="speaking" i]',
      '[data-tooltip*="speaking" i]',
      '[data-is-speaking="true"]',
      '[data-speaking="true"]',
      '[data-active-speaker="true"]',
    ],
    showEveryoneBtn: '[aria-label*="Show everyone"]',
  };

  function queryFirst(
    selectors: string[],
    root: Document | HTMLElement = document,
  ): HTMLElement | null {
    for (const selector of selectors) {
      const el = root.querySelector(selector);
      if (el) return el as HTMLElement;
    }
    return null;
  }

  function getTextValue(el: HTMLElement | null): string {
    if (!el) return "";
    if ("value" in el) return String((el as HTMLInputElement).value || "").trim();
    return String(el.textContent || "").trim();
  }

  function closestParticipantTile(el: Element): HTMLElement | null {
    for (const selector of SELECTORS.participantTile) {
      const tile = el.closest(selector);
      if (tile) return tile as HTMLElement;
    }

    return null;
  }

  function classListIncludesSpeakingCue(el: Element): boolean {
    const className = String(el.getAttribute("class") || "");
    return /\b(active[-_\s]?speaker|speaking|is[-_\s]?speaking|voice[-_\s]?active)\b/i.test(
      className,
    );
  }

  function hasActiveSpeakerCue(el: Element): boolean {
    const ariaLabel = String(el.getAttribute("aria-label") || "");
    if (/\bspeaking\b/i.test(ariaLabel)) return true;

    if (
      el.getAttribute("data-is-speaking") === "true" ||
      el.getAttribute("data-speaking") === "true" ||
      el.getAttribute("data-active-speaker") === "true"
    ) {
      return true;
    }

    if (classListIncludesSpeakingCue(el)) return true;

    return SELECTORS.activeSpeakerIndicators.some((selector) =>
      Boolean(el.querySelector(selector)),
    );
  }

  function participantNameFromTile(tile: HTMLElement): string | null {
    const directName = participantNameFromCandidate({
      ariaLabel: tile.getAttribute("aria-label"),
      selfName: tile.getAttribute("data-self-name"),
      text: getTextValue(tile),
    });
    if (directName) return directName;

    const nameElement = queryFirst(SELECTORS.participantNodes, tile);
    return participantNameFromCandidate({
      ariaLabel: nameElement?.getAttribute("aria-label"),
      selfName: nameElement?.getAttribute("data-self-name"),
      text: getTextValue(nameElement),
    });
  }

  function setInputValue(el: HTMLElement, value: string) {
    el.focus();
    try {
      document.execCommand("selectAll", false, undefined);
      document.execCommand("insertText", false, value);
    } catch (e) {
      console.warn(`${COPILOT_PREFIX} execCommand failed, falling back to property set`, e);
      if ("value" in el) {
        (el as HTMLInputElement).value = value;
      } else {
        el.textContent = value;
      }
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function wait(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function findChatInputWithRetry(attempts = 6): Promise<HTMLElement | null> {
    for (let i = 0; i < attempts; i += 1) {
      const input = queryFirst(SELECTORS.chatInput);
      if (input) return input;
      await wait(300);
    }
    return null;
  }

  async function ensureChatPanelOpen(): Promise<HTMLElement | null> {
    const existingInput = queryFirst(SELECTORS.chatInput);
    if (existingInput) return existingInput;

    const chatToggle = queryFirst(SELECTORS.chatToggleButtons);
    if (chatToggle) {
      chatToggle.click();
      await wait(500);
      return findChatInputWithRetry(10);
    }

    return null;
  }

  async function sendChatMessage(message: string): Promise<boolean> {
    console.log(`${COPILOT_PREFIX} Attempting to send chat message.`);

    try {
      const chatInput = await ensureChatPanelOpen();
      if (!chatInput) {
        console.error(`${COPILOT_PREFIX} Could not find chat input box.`);
        return false;
      }

      setInputValue(chatInput, message);
      await wait(150);

      const sendButton = queryFirst(SELECTORS.sendButton) as HTMLButtonElement | null;
      if (
        sendButton &&
        !sendButton.disabled &&
        sendButton.getAttribute("aria-disabled") !== "true"
      ) {
        sendButton.click();
      } else {
        chatInput.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            bubbles: true,
          }),
        );
      }

      console.log(`${COPILOT_PREFIX} Chat message send attempted.`);
      return true;
    } catch (err) {
      console.error(`${COPILOT_PREFIX} Error sending chat message:`, err);
      return false;
    }
  }

  function upsertBriefOverlay(briefContent: string, targetName?: string) {
    const overlayId = "mc-brief-overlay";
    let overlay = document.getElementById(overlayId);

    const closeOverlay = () => {
      if (!overlay) return;
      overlay.classList.remove("mc-visible");
      window.setTimeout(() => {
        overlay?.remove();
        overlay = null;
      }, 550);
    };

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = overlayId;

      const card = document.createElement("div");
      card.className = "mc-brief-card";

      const header = document.createElement("div");
      header.className = "mc-brief-header";

      const icon = document.createElement("div");
      icon.className = "mc-brief-icon";
      icon.textContent = "🧠";

      const title = document.createElement("div");
      title.className = "mc-brief-title";
      title.textContent = targetName ? `Brief for ${targetName}` : "Meeting brief";

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "mc-brief-close";
      closeBtn.setAttribute("aria-label", "Close brief");
      closeBtn.textContent = "✕";
      closeBtn.addEventListener("click", closeOverlay);

      header.append(icon, title, closeBtn);

      const greeting = document.createElement("div");
      greeting.className = "mc-brief-greeting";
      greeting.textContent = targetName ? `Welcome, ${targetName}` : "Welcome back";

      const text = document.createElement("div");
      text.className = "mc-brief-text";
      text.textContent = String(briefContent || "No brief content available.");

      const footer = document.createElement("div");
      footer.className = "mc-brief-footer";
      footer.textContent = "Late Meet — private brief (only visible to you)";

      card.append(header, greeting, text, footer);
      overlay.appendChild(card);

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeOverlay();
      });

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay?.classList.add("mc-visible"));
    } else {
      const title = overlay.querySelector(".mc-brief-title");
      if (title) title.textContent = targetName ? `Brief for ${targetName}` : "Meeting brief";

      const greeting = overlay.querySelector(".mc-brief-greeting");
      if (greeting) greeting.textContent = targetName ? `Welcome, ${targetName}` : "Welcome back";

      const text = overlay.querySelector(".mc-brief-text");
      if (text) text.textContent = String(briefContent || "No brief content available.");

      overlay.classList.add("mc-visible");
    }
  }

  async function collectParticipants(): Promise<{
    participants: string[];
    selfName: string | null;
  }> {
    const candidates: ParticipantNameCandidate[] = [];
    // We scrape participant elements already present in the DOM (video tiles or side panel).
    // To prevent disrupting the user's view, we do not force-click the "Show everyone" button in the polling loop.
    const participantElements = new Set<HTMLElement>();
    let selfName: string | null = null;

    for (const selector of SELECTORS.participantNodes) {
      document.querySelectorAll(selector).forEach((node) => {
        participantElements.add(node as HTMLElement);
      });
    }

    for (const element of participantElements) {
      if (!selfName) {
        const rawSelfName = element.getAttribute("data-self-name");
        if (rawSelfName) {
          selfName = participantNameFromCandidate({ selfName: rawSelfName });
        }
      }
      candidates.push({
        ariaLabel: element.getAttribute("aria-label"),
        selfName: element.getAttribute("data-self-name"),
        text: getTextValue(element),
      });
    }

    return { participants: collectParticipantNames(candidates), selfName };
  }

  let participantPollTimer: number | NodeJS.Timeout | null = null;
  let activeSpeakerObserver: MutationObserver | null = null;
  let activeSpeakerCheckTimer: number | NodeJS.Timeout | null = null;
  let lastActiveSpeakerName: string | null = null;

  function startParticipantPolling() {
    if (participantPollTimer) return;

    participantPollTimer = setInterval(async () => {
      const { participants, selfName } = await collectParticipants();

      try {
        await chrome.runtime.sendMessage({
          type: "PARTICIPANTS_UPDATED",
          participants,
          selfName,
        });
      } catch {
        // Service worker idle
      }
    }, 5000);
  }

  function scheduleActiveSpeakerCheck() {
    if (activeSpeakerCheckTimer) return;

    activeSpeakerCheckTimer = setTimeout(() => {
      activeSpeakerCheckTimer = null;
      detectActiveSpeaker();
    }, 250);
  }

  async function publishActiveSpeaker(name: string) {
    if (name === lastActiveSpeakerName) return;

    try {
      await chrome.runtime.sendMessage({
        type: "ACTIVE_SPEAKER_CHANGED",
        name,
      });
      lastActiveSpeakerName = name;
    } catch {
      // Service worker idle
    }
  }

  function detectActiveSpeaker() {
    const candidates = new Set<HTMLElement>();

    SELECTORS.activeSpeakerIndicators.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        const tile = closestParticipantTile(node);
        if (tile) candidates.add(tile);
      });
    });

    document.querySelectorAll(SELECTORS.participantTile.join(",")).forEach((node) => {
      const element = node as HTMLElement;
      if (hasActiveSpeakerCue(element)) {
        candidates.add(element);
      }
    });

    for (const tile of candidates) {
      const name = participantNameFromTile(tile);
      if (name) {
        void publishActiveSpeaker(name);
        return;
      }
    }
  }

  function startActiveSpeakerDetection() {
    if (activeSpeakerObserver) return;

    function isSpeakerRelatedNode(node: Node): boolean {
      if (!(node instanceof Element)) return false;
      return (
        Boolean(closestParticipantTile(node)) ||
        node.matches(SELECTORS.activeSpeakerIndicators.join(",")) ||
        Boolean(node.querySelector(SELECTORS.activeSpeakerIndicators.join(",")))
      );
    }

    activeSpeakerObserver = new MutationObserver((mutations) => {
      const sawSpeakerRelatedChange = mutations.some((mutation) => {
        if (mutation.type === "childList") {
          return (
            isSpeakerRelatedNode(mutation.target) ||
            Array.from(mutation.addedNodes).some(isSpeakerRelatedNode) ||
            Array.from(mutation.removedNodes).some(isSpeakerRelatedNode)
          );
        }
        if (mutation.type !== "attributes") return false;

        const name = mutation.attributeName || "";
        return (
          name === "class" || name === "style" || name === "aria-label" || name.startsWith("data-")
        );
      });

      if (sawSpeakerRelatedChange) scheduleActiveSpeakerCheck();
    });

    activeSpeakerObserver.observe(document.body, {
      attributes: true,
      attributeFilter: [
        "class",
        "style",
        "aria-label",
        "data-is-speaking",
        "data-speaking",
        "data-active-speaker",
      ],
      childList: true,
      subtree: true,
    });

    detectActiveSpeaker();
  }

  function injectFloatingButton() {
    const existing = document.getElementById("mc-float-btn");
    if (existing) return;

    const btn = document.createElement("button");
    btn.id = "mc-float-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Start Late Meet Copilot");

    const inner = document.createElement("div");
    inner.className = "mc-float-btn-inner";

    const pulse = document.createElement("div");
    pulse.className = "mc-float-pulse";

    const icon = document.createElement("span");
    icon.className = "mc-float-icon";
    icon.textContent = "🎙️";

    inner.append(pulse, icon);

    const label = document.createElement("span");
    label.className = "mc-float-label";
    label.textContent = "Start Copilot";

    btn.append(inner, label);

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      label.textContent = "Opening Copilot...";

      try {
        // Open the side panel (dashboard) where tabCapture can be properly initiated
        // with user gesture context. Content scripts cannot use chrome.tabCapture.
        await chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" });
        btn.remove();
      } catch (err) {
        console.error(`${COPILOT_PREFIX} Error opening side panel:`, err);
        btn.disabled = false;
        label.textContent = "Start Copilot";
      }
    });

    document.body.appendChild(btn);
    requestAnimationFrame(() => btn.classList.add("mc-visible"));
  }

  const observer = new MutationObserver(() => {
    if (window.location.pathname.length > 5 && !window.location.pathname.includes("/_")) {
      injectFloatingButton();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "SHOW_BRIEF") {
      upsertBriefOverlay(message.briefContent, message.targetName);
      sendResponse({ success: true });
      return false;
    }

    if (message?.type === "SEND_CHAT_MESSAGE") {
      sendChatMessage(message.text).then((success) => sendResponse({ success }));
      return true;
    }

    if (message?.type === "STATE_UPDATE") {
      const btn = document.getElementById("mc-float-btn") as HTMLButtonElement | null;
      const isActive = message.state?.isActive;
      if (btn && isActive) {
        btn.remove();
      } else if (!btn && !isActive) {
        injectFloatingButton();
      } else if (btn && !isActive) {
        btn.disabled = false;
        const label = btn.querySelector(".mc-float-label");
        if (label) label.textContent = "Start Copilot";
      }
      sendResponse({ success: true });
      return false;
    }

    // Don't handle unknown messages — let other listeners process them
    return false;
  });

  startParticipantPolling();
  startActiveSpeakerDetection();
  if (window.location.pathname.length > 5 && !window.location.pathname.includes("/_")) {
    injectFloatingButton();
  }
})();
