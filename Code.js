/***** CONFIG *****/
const CALENDAR_ID = 'e4b9418680885516debe5f3acb6068a4b31512cde0a2eb565528986a42190d5f@group.calendar.google.com';
const SHEET_NAME = 'Form Responses 1';
const ADMIN_EMAIL = 'it493trails@gmail.com';
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzYwQUV21yBD5Qu_bgeiZAXemWDP6TXk368IxtHgk-hnvG5z32VHIUC88EH53xDeMpb/exec";

const COL_TIMESTAMP = 1, COL_NAME = 2, COL_EMAIL = 3, COL_PHONE = 4, COL_DATE = 5, COL_START = 6, COL_END = 7, COL_HALL_OPTION = 8, COL_STATUS = 12, COL_EVENT_ID = 13, COL_PRICE = 14;

/***** 1. On form submission *****/
function onFormSubmit(e) {
  console.log("STATUS 1: onFormSubmit called");

  if (!e) {
    console.error("ERR: Environment attribute not provided to the onFormSubmit function");
    return;  
  }

  // Get values from the spreadsheet
  const sheet = e.range.getSheet();
  if (sheet === null || sheet === undefined || sheet === "") {
    console.log("ERR: Environmental attribute not properly defined");
    return;
  }
  if (sheet.getName() !== SHEET_NAME) {
    console.error("ERR: Environmental sheet name does not match SHEET_NAME value in code");
    return;
  }

  const row = e.range.getRow();
  const range = sheet.getRange(row, 1, 1, sheet.getLastColumn());
  const values = range.getValues()[0];
  const displayValues = range.getDisplayValues()[0];

  const name = values[COL_NAME - 1];
  const email = values[COL_EMAIL - 1];
  const phone = values[COL_PHONE - 1]; 
  const date = values[COL_DATE - 1];        
  const startTimeStr = displayValues[COL_START - 1];  
  const endTimeStr = displayValues[COL_END - 1];      

  const startDateTime = combineDateAndTimeString(date, startTimeStr);
  const endDateTime = combineDateAndTimeString(date, endTimeStr);

  const cal = CalendarApp.getCalendarById(CALENDAR_ID);
  const title = 'Hall Booking - ' + name;

  const conflicts = cal.getEvents(startDateTime, endDateTime);
  
  // Checks for calendar conflicts
  if (conflicts && conflicts.length > 0) {
    sheet.getRange(row, COL_STATUS).setValue('Time Unavailable');

    sendConflictEmail(email, name, date, startDateTime, endDateTime);

    // Automatically declines the reservation if conflict is detected
    processDecline(sheet, row);
    return;
  }

  // Create calendar event
  const event = cal.createEvent(title, startDateTime, endDateTime, {
    description: 'TENTATIVE hall booking – awaiting admin approval.\n\nName: ' + name + '\nEmail: ' + email + '\nPhone: ' + phone + '\nStatus: Pending',
    guests: email,
    sendInvites: false
  });

  // Updates status to pending and adds event ID to spreadsheet
  sheet.getRange(row, COL_STATUS).setValue('Pending');
  sheet.getRange(row, COL_EVENT_ID).setValue(event.getId());

  sendReceptionEmail(email, name, date, startDateTime, endDateTime);

  // Sends the admin approval email
  if (WEB_APP_URL && ADMIN_EMAIL) {
    const approveUrl = WEB_APP_URL + '?row=' + row + '&action=approve';
    const declineUrl = WEB_APP_URL + '?row=' + row + '&action=decline';
    const htmlAdmin = '<p><b>New hall booking request</b></p>' +
      '<p><b>Name:</b> ' + name + '<br>' +
      '<b>Email:</b> ' + email + '<br>' +
      '<b>Phone:</b> ' + phone + '<br>' +
      '<b>Date:</b> ' + formatDate(date) + '<br>' +
      '<b>Time:</b> ' + formatTime(startDateTime) + ' - ' + formatTime(endDateTime) + '</p>' +
      '<p><a href="' + approveUrl + '" style="padding:8px 16px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:4px;">Approve</a> ' +
      '<a href="' + declineUrl + '" style="padding:8px 16px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:4px;margin-left:8px;">Decline</a></p>';
    MailApp.sendEmail({ to: ADMIN_EMAIL, subject: 'New hall booking request (row ' + row + ')', htmlBody: htmlAdmin });
  }
  console.log("INFO: Admin approval request sent");
}

/***** 2. Approval / Decline Helpers *****/
function processApproval(sheet, row) {
  console.log("INFO: Reservation approved");
  const range = sheet.getRange(row, 1, 1, sheet.getLastColumn());
  const values = range.getValues()[0];
  const displayValues = range.getDisplayValues()[0];

  const name = values[COL_NAME - 1];
  const email = values[COL_EMAIL - 1];
  const date = values[COL_DATE - 1];
  const eventId = values[COL_EVENT_ID - 1];

  const startDateTime = combineDateAndTimeString(date, displayValues[COL_START - 1]);
  const endDateTime = combineDateAndTimeString(date, displayValues[COL_END - 1]);

  // 1) Update calendar if event exists (ONLY this part depends on eventId)
  const cal = CalendarApp.getCalendarById(CALENDAR_ID);
  if (eventId) {
    try {
      const event = cal.getEventById(eventId);
      if (event) {
        event.setDescription('BOOKED hall event.\n\nName: ' + name + '\nStatus: Approved.');
        event.setColor(CalendarApp.EventColor.GREEN);
      }
    } catch (e) {
      Logger.log('Event not found: ' + eventId);
    }
  }
  console.log("INFO: Calendar status updated (if found)");

  // 2) Pricing + Stripe (NOT inside eventId block)
  const hallType = values[COL_HALL_OPTION - 1];
  const totalCents = calculateTotalCents(hallType, date, startDateTime, endDateTime);
  const totalDollars = totalCents / 100;

  // Add price to the sheet
  sheet.getRange(row, COL_PRICE).setValue(totalDollars + 250);

  const description =
    hallType + ' Hall Rental - ' + name + ' - ' + formatDate(date) + ' ' +
    formatTime(startDateTime) + ' to ' + formatTime(endDateTime) +
    ' (' + billableHours(startDateTime, endDateTime) + ' hour(s))';

  // Send payment link
  const paymentLink = sendPaymentLinkToCustomer(totalDollars, description, email);
  console.log("INFO: Payment link sent");

  // 3) Save status as booked
  sheet.getRange(row, COL_STATUS).setValue('Booked');

  // 4) Email customer (include link here too, as a backup)
  sendConfirmationEmail(email, name, date, startDateTime, endDateTime, totalDollars + 250, paymentLink);
}

// This function is used when we decide to decline a reservation
function processDecline(sheet, row) {
  const range = sheet.getRange(row, 1, 1, sheet.getLastColumn());
  const values = range.getValues()[0];
  const displayValues = range.getDisplayValues()[0];
  const name = values[COL_NAME - 1];
  const email = values[COL_EMAIL - 1];
  const date = values[COL_DATE - 1];
  const startDateTime = combineDateAndTimeString(date, displayValues[COL_START - 1]);
  const endDateTime = combineDateAndTimeString(date, displayValues[COL_END - 1]);

  const eventId = values[COL_EVENT_ID - 1];
  const cal = CalendarApp.getCalendarById(CALENDAR_ID);

  // Check if event exists, if so delete it
  if (eventId) {
    try {
      const event = cal.getEventById(eventId);
      if (event) event.deleteEvent();
    } catch (e) {
      console.warn("WARNING: Event with eventID: " + eventID + " does not exist");
    }
  }

  // Sets status colomn to Declined
  sheet.getRange(row, COL_STATUS).setValue('Declined');

  // Sends rejection email
  sendRejectionEmail(email, name, date, startDateTime, endDateTime);
}

/***** 3. Handlers *****/
const SPREADSHEET_ID = '1aCRK6M5h7PTHiqzFfCK_PRsxz0svl-GL6jcsDOz1Lbg';

// This function handles the result of the approval email.
function doGet(e) {
  console.log("INFO: doGet running...")
  const row = parseInt(e.parameter.row, 10);
  console.log("Row: " + row);
  const action = String(e.parameter.action || '').toLowerCase();

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  // Calls the processApproval or processDecline function based on the action
  switch (action) {
    case "approve": processApproval(sheet, row);
      break;
    case "decline": processDecline(sheet, row);
      break;
    default:
      console.error("ERR: Unexpected action: " + action + ", auto-declining");
      processDecline(sheet, row);
      break;
  }

  // Returns the following message afterwards
  return HtmlService.createHtmlOutput('Action completed successfully.');
}

// Everytime the spreadsheet is manually edited, we check the value of the status column
// This function enables manual approval or denials.
function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME || e.range.getColumn() !== COL_STATUS) return;
  const val = String(e.range.getValue()).trim();
  if (val === 'Approved') processApproval(sheet, e.range.getRow());
  if (val === 'Declined') processDecline(sheet, e.range.getRow());
}

/***** 4. HELPERS *****/
function combineDateAndTimeString(dateValue, timeString) {
  const combined = new Date(dateValue);
  const timeParts = timeString.match(/(\d+):(\d+)/);
  if (!timeParts) return combined;
  let hours = parseInt(timeParts[1], 10);
  const minutes = parseInt(timeParts[2], 10);
  if (timeString.toLowerCase().includes('pm') && hours < 12) hours += 12;
  if (timeString.toLowerCase().includes('am') && hours === 12) hours = 0;
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

function formatDate(d) { return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'MMM dd, yyyy'); }
function formatTime(d) { return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'h:mm a'); }

// Used when permissions change. Prompts you to authorize the permissions.
function authorizeOnce() { SpreadsheetApp.getActive(); CalendarApp.getAllCalendars(); }

// Not currently used.
function testProcessApproval() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  const testRow = 2; // 👈 pick a real row with booking data
  processApproval(sheet, testRow);
}