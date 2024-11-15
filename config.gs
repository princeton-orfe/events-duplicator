// Calendars to synchronize from.
const sourceCalendars = {
    'Calendar Name': 'GCAL_ID'
};

// Calendar to synchronize to.
const destinationCalendarId = 'GCAL_ID';

// Time window in months behind and ahead.
const timeWindow = getTimeWindow(0, 1);

// Enable or disable verbose email debug log.
var debug = false;

// Email addresses for report delivery.
const emails = ['valid@email'];
