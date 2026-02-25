// Sends the reservation time conflict email
function sendConflictEmail (email, name, date, startDateTime, endDateTime) {
    MailApp.sendEmail({
      to: email,
      subject: 'Hall booking time unavailable',
      body: `Hi ${name},\n\n
            Thank you for your hall booking request. Unfortunately, the date and time you selected is not available:\n\n
            Requested:\n
            Date: ${formatDate(date)}\n
            Time: ${formatTime(startDateTime)} - ${formatTime(endDateTime)}\n\n
            Please submit another request with a different date or time.\n\n
            Best regards,\nHall Booking Team`
    });
    console.log("INFO: Time conflict rejection email sent");
  }
  
  // Sends the reservation request received email
  function sendReceptionEmail (email, name, date, startDateTime, endDateTime) {
    MailApp.sendEmail({
      to: email,
      subject: 'We received your hall booking request',
      body: 'Hi ' + name + ',\n\n' +
            'Thank you for your hall booking request. We have received the following details:\n\n' +
            'Date: ' + formatDate(date) + '\n' +
            'Time: ' + formatTime(startDateTime) + ' - ' + formatTime(endDateTime) + '\n\n' +
            'Your booking is currently pending admin approval. We will email you once it is approved.\n\n' +
            'Best regards,\nHall Booking Team'
    });
    console.log("INFO: Reservation received email sent");
  }
  
  // Sends the reservation confirmation email
  function sendConfirmationEmail (email, name, date, startDateTime, endDateTime, totalDollars, paymentLink) {
    MailApp.sendEmail({
      to: email,
      subject: 'Your hall booking is confirmed',
      body:
        'Hi ' + name + ',\n\n' +
        'Good news! Your hall booking has been APPROVED and is now confirmed.\n\n' +
        'Details:\n' +
        'Date: ' + formatDate(date) + '\n' +
        'Time: ' + formatTime(startDateTime) + ' - ' + formatTime(endDateTime) + '\n' +
        'Total: $' + totalDollars.toFixed(2) + '\n\n' +
        'Payment link:\n' + (paymentLink && paymentLink.url ? paymentLink.url : '[missing link]') + '\n\n' +
        'Best regards,\nHall Booking Team'
    });
    console.log("INFO: Confirmation email sent");
  }
  
  // Sends the hall reservation rejection email
  function sendRejectionEmail (email, name, date, startDateTime, endDateTime) {
    MailApp.sendEmail({
      to: email,
      subject: 'Update on your hall booking request',
      body: 'Hi ' + name + ',\n\n' +
            'Thank you for your hall booking request for:\n' +
            'Date: ' + formatDate(date) + '\n' +
            'Time: ' + formatTime(startDateTime) + ' - ' + formatTime(endDateTime) + '\n\n' +
            'We’re sorry, but we are unable to confirm your booking for this time.\n' +
            'Please feel free to submit another request.\n\n' +
            'Best regards,\nHall Booking Team'
    });
    console.log("INFO: Rejection email sent");
  }