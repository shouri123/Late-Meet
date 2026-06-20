const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
}

export interface CalendarApiError {
  code: number;
  message: string;
  retryable: boolean;
}

function isCalendarApiError(err: unknown): CalendarApiError {
  if (err && typeof err === "object" && "result" in err) {
    const result = (err as { result: { error?: { code?: number; message?: string } } }).result;
    if (result?.error) {
      const code = result.error.code ?? 0;
      return {
        code,
        message: result.error.message ?? "Unknown Google Calendar API error",
        retryable: code === 429 || (code >= 500 && code < 600),
      };
    }
  }
  if (err instanceof TypeError && err.message === "Failed to fetch") {
    return {
      code: 0,
      message: "Unable to reach Google Calendar. Check your internet connection.",
      retryable: true,
    };
  }
  return {
    code: 0,
    message: err instanceof Error ? err.message : "Unknown error occurred",
    retryable: false,
  };
}

async function getAuthToken(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false, scopes: SCOPES }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error("Not authenticated with Google Calendar. Please sign in."));
        return;
      }
      resolve(token);
    });
  });
}

async function calendarFetch<T>(
  path: string,
  params: Record<string, string> = {},
  retries = 2,
): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const url = `${GOOGLE_CALENDAR_BASE}${path}${query ? `?${query}` : ""}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let token: string;
    try {
      token = await getAuthToken();
    } catch (err) {
      throw {
        code: 401,
        message: err instanceof Error ? err.message : "Authentication failed",
        retryable: false,
      } satisfies CalendarApiError;
    }

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const code = response.status;
        const errMsg = body?.error?.message ?? response.statusText;

        if ((code === 401 || code === 403) && attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        throw {
          code,
          message: `Calendar API error (${code}): ${errMsg}`,
          retryable: code === 429 || (code >= 500 && code < 600),
        } satisfies CalendarApiError;
      }

      return (await response.json()) as T;
    } catch (err) {
      if (attempt < retries && (err as CalendarApiError)?.retryable !== false) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw isCalendarApiError(err);
    }
  }

  throw {
    code: 0,
    message: "Failed to reach Google Calendar after multiple attempts.",
    retryable: true,
  } satisfies CalendarApiError;
}

export async function fetchUpcomingEvents(
  maxResults = 10,
  calendarId = "primary",
): Promise<CalendarEvent[]> {
  try {
    const data = await calendarFetch<{ items: CalendarEvent[] }>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        maxResults: String(maxResults),
        singleEvents: "true",
        orderBy: "startTime",
      },
    );
    return data.items ?? [];
  } catch (err) {
    const apiErr = err as CalendarApiError;
    console.error("[LateMeet][Calendar] Failed to fetch events:", apiErr.message);
    throw apiErr;
  }
}

export function getUserFriendlyErrorMessage(error: CalendarApiError): string {
  switch (error.code) {
    case 401:
      return "Your Google Calendar session has expired. Please sign in again in the extension settings.";
    case 403:
      return "You don't have permission to access Google Calendar. Check your account permissions.";
    case 404:
      return "The requested calendar was not found. It may have been deleted or you may not have access.";
    case 429:
      return "Too many requests to Google Calendar. Please wait a moment and try again.";
    case 0:
      return (
        error.message ||
        "Unable to connect to Google Calendar. Please check your internet connection."
      );
    default:
      if (error.code >= 500) {
        return "Google Calendar is temporarily unavailable. Please try again later.";
      }
      return error.message || "An unexpected error occurred while fetching your calendar.";
  }
}
