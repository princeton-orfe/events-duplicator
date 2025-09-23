# Events Duplicator (Google Apps Script)

> Keep a destination Google Calendar in sync with events from one or more source calendars. Designed for departmental/organizational roll‑up calendars.

## What this does

- Aggregates events from multiple Google Calendars into a single destination calendar
- De‑duplicates identical events across sources and prefixes the title with the originating calendar name(s)
- Preserves all‑day vs timed events accurately
- Sends an email report after each run (optional verbose debug logs)
- Intended to run on a time-based trigger for continuous synchronization

External calendars are supported indirectly: subscribe to any ICS feed in Google Calendar first; that subscription appears as a normal calendar which can be used as a source.

The logic lives in two files:

- `config.gs` — your configuration (source calendars, destination calendar, time window, email settings)
- `gs-events-duplicator.gs` — the synchronization logic

Run the function `copyNewEventsFromMultipleCalendars` on a schedule.

## Features

- Multiple sources to one destination
- Title prefix shows source calendar(s), e.g. `Dept A, Dept B: Colloquium`
- Event identity is tracked via a "Source Event ID" appended to the description
- All‑day event handling (creates true all‑day entries)
- Update-on-change for title/description/location within the sync window
- Email summary after each run; optional detailed debug logs
- Concurrency-safe with script-level locking

## How it works (brief)

1. For each source calendar in `sourceCalendars`, fetch events within a configurable window (`getTimeWindow(monthsBack, monthsForward)`).
2. Build a map of unique events across sources using an identifier: `title_without_prefix + startTime + endTime`.
3. For each unique event:
	- Title becomes `<Comma-separated source calendar names>: <Original title>`.
	- Append `Source Event ID: <identifier>` to the description.
	- Create or update the event in the destination calendar. All‑day events are created as true all‑day events.
4. Email a run summary (and debug logs when enabled).

Known limitation: if a source event’s start or end time changes, the identifier changes (because it includes time). The script doesn’t delete the old destination event; it will create a new one with the new identifier. See "Limitations" below for details and cleanup tips.

## Prerequisites

- A Google account with access to the source calendar(s) and the destination calendar
- Google Apps Script access (free, via script.google.com)

## Setup

1. Open Google Apps Script (https://script.google.com) and create a new Standalone project.
2. Create two script files and paste the contents from this repo:
	- `config.gs`
	- `gs-events-duplicator.gs`
3. In `config.gs`, configure:

```js
// Calendars to synchronize from: { 'Human Readable Name': 'calendar_id@group.calendar.google.com' }
const sourceCalendars = {
  'Calendar Name': 'GCAL_ID'
};

// Calendar to synchronize to
const destinationCalendarId = 'GCAL_ID';

// Time window in months behind and ahead
const timeWindow = getTimeWindow(0, 1); // e.g., past 0 months, next 1 month

// Enable verbose email debug log
var debug = false;

// Email addresses for report delivery
const emails = ['you@example.com'];
```

4. Find Calendar IDs in Google Calendar:
	- Open Google Calendar → Settings → select a calendar → "Integrate calendar" → copy the "Calendar ID".
	- For your primary calendar, the ID is usually your email address; for others it ends with `@group.calendar.google.com`.
5. Save the project.

## First run and authorization

1. In the Apps Script editor, select the function `copyNewEventsFromMultipleCalendars` and click Run.
2. Authorize the script when prompted. It needs access to:
	- Calendar (read from sources, write to destination)
	- Mail (send email summary)
3. Check your inbox for the summary email and verify events were created/updated on the destination calendar.

## Scheduling (recommended)

Set up a time-based trigger to keep the destination calendar up-to-date:

1. In the Apps Script editor, click Triggers (alarm clock icon).
2. "Add Trigger":
	- Choose function: `copyNewEventsFromMultipleCalendars`
	- Event source: Time-driven
	- Type of time-based trigger: e.g., Hour timer
	- Select frequency: e.g., Every hour (or as needed in your environment)
3. Save.

Tip: To stay within quotas and avoid duplicates, avoid overlapping, very frequent triggers with long windows. An hourly or 2–4 hour cadence is typical.

## Configuration guidance

- Time window: Keep it as small as practical (e.g., 0 months back, 1–2 months forward) to reduce processing time and API calls.
- Debug: Set `debug = true` temporarily when you need detailed diagnostics; your summary email will include a "Debug Logs" section.
- Email recipients: Add team members to `emails` to share run summaries.
- Source names: The keys in `sourceCalendars` are used in the title prefix; keep them short and recognizable.

## Behavior details

- De-duplication across sources: Events are considered the same if their title (ignoring any existing prefix), start time, and end time are identical. When found in multiple sources, the destination title is prefixed with all matching source names, e.g., `Calendar A, Calendar B: Event`.
- Identity tracking: The script appends `Source Event ID: <identifier>` to the destination event description and uses that to find/update existing events.
- Updates: If an event with the same identifier exists, it updates title, description, location, and times (for non-all-day events) when mismatches are detected.
- All‑day events: Correctly identified and created as true all‑day events (using `createAllDayEvent` / `setAllDayDate`).
- Locking: A script lock prevents concurrent runs from overlapping.

## Limitations and tips

- Start/end time changes: Because the identifier includes start and end times, a time change in the source yields a new identifier. The script won’t match the old destination event and will create a new one. Clean up stale events in the destination by searching for the old title or for `Source Event ID:` in the description.
- Outside window: Events moved outside the configured window won’t be touched by the script until they re-enter the window.
- ICS latency: Subscribed ICS calendars may update with delays; the destination reflects whatever Google Calendar shows for the source at run time.
- Quotas: Apps Script and CalendarApp have daily quotas. Keep windows/frequency reasonable, and reduce the number of source calendars if you hit limits.

## Troubleshooting

- "Calendar not found" in email: The configured ID is wrong or not accessible to the account running the script. Recheck the Calendar ID and sharing.
- Duplicate events: Often due to source time edits (see limitation above). Manually remove stale destination events. Consider reducing the sync window and/or cadence.
- All‑day events appearing as timed: Ensure the source all‑day event truly starts at 12:00 AM and ends at 12:00 AM the next day.
- No summary email: Verify `emails` in `config.gs` and that the account can send mail (MailApp quota not exhausted).
- Authorization prompts repeat: Make sure you’re running the script under the same account that owns the destination calendar and has access to sources.

## Maintenance / Uninstall

- To pause: Disable or delete the time-based trigger.
- To remove: Delete the trigger and the Apps Script project. Destination events remain; you can search for `Source Event ID:` in the description to locate items created by this script.

## Contributing

Issues and improvements are welcome. Potential enhancements:

- A cleanup/garbage-collection utility to remove orphaned events when times change
- A fallback matching strategy that tolerates minor source edits (e.g., fuzzy match without time in the key)
- Script Properties for storing config and support for multiple destination calendars

## File overview

- `config.gs` — Set `sourceCalendars`, `destinationCalendarId`, `timeWindow`, `debug`, and `emails`.
- `gs-events-duplicator.gs` — Core sync function `copyNewEventsFromMultipleCalendars`, helpers for identity, matching, updates, and email reporting.

## Disclaimer

Use at your own risk. Test with a non‑production destination calendar before deploying widely.
