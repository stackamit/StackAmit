import sgMail from "@sendgrid/mail";

const isSendGridConfigured = () => {
  const key = process.env.SENDGRID_API_KEY;
  return key && key.startsWith("SG.");
};

if (isSendGridConfigured()) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn("SendGrid: Invalid API key. Email sending is disabled.");
}

const sendEmail = async (msg) => {
  if (!isSendGridConfigured()) {
    console.warn(
      `Email not sent (SendGrid not configured). Would have sent to: ${msg.to}, subject: ${msg.subject}`,
    );
    return { success: false, error: "Email service not configured" };
  }
  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error("SendGrid Error:", error.response?.body || error.message);
    return { success: false, error: error.message };
  }
};

export const sendWelcomeStudentEmail = async (to, name, tempPassword) => {
  const credentialsSection = tempPassword
    ? `<div class="credentials">
        <p><strong>Email:</strong> ${to}</p>
        <p><strong>Temporary Password:</strong> ${tempPassword}</p>
       </div>
       <p>Please log in and change your password immediately for security purposes.</p>`
    : `<div class="credentials">
        <p><strong>Email:</strong> ${to}</p>
       </div>
       <p>You can now log in with the password you chose during registration.</p>`;

  const msg = {
    to,
    from: process.env.EMAIL_FROM,
    subject: "Welcome to StackAmit Internship Program!",
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>
        body { font-family: 'Segoe UI', sans-serif; background: #f4f7fc; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }
        .header h1 { color: #fff; margin: 0; font-size: 28px; }
        .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; }
        .body { padding: 30px; }
        .body h2 { color: #1a1a2e; }
        .body p { color: #555; line-height: 1.7; }
        .credentials { background: #f8f9ff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .credentials p { margin: 8px 0; }
        .credentials strong { color: #333; }
        .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 10px 0; }
        .footer { background: #f8f9ff; padding: 20px 30px; text-align: center; color: #888; font-size: 13px; }
      </style></head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to StackAmit!</h1>
            <p>Your internship journey starts here at StackAmit</p>
          </div>
          <div class="body">
            <h2>Hello ${name},</h2>
            <p>Welcome to the StackAmit Internship Management System! Your email has been verified and your account is now active.</p>
            ${credentialsSection}
            <a href="${process.env.CLIENT_URL}/login" class="btn">Login to Your Account</a>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} StackAmit. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
  return sendEmail(msg);
};

export const sendWelcomeTrainerEmail = async (to, name, tempPassword) => {
  const msg = {
    to,
    from: process.env.EMAIL_FROM,
    subject: "Welcome to StackAmit as a Trainer!",
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>
        body { font-family: 'Segoe UI', sans-serif; background: #f4f7fc; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px 30px; text-align: center; }
        .header h1 { color: #fff; margin: 0; font-size: 28px; }
        .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; }
        .body { padding: 30px; }
        .body h2 { color: #1a1a2e; }
        .body p { color: #555; line-height: 1.7; }
        .credentials { background: #f0fff4; border: 1px solid #c6f6d5; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .credentials p { margin: 8px 0; }
        .btn { display: inline-block; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .footer { background: #f8f9ff; padding: 20px 30px; text-align: center; color: #888; font-size: 13px; }
      </style></head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome, Trainer!</h1>
            <p>StackAmit Internship Platform</p>
          </div>
          <div class="body">
            <h2>Hello ${name},</h2>
            <p>You have been added as a Trainer on the StackAmit Internship Management System.</p>
            <div class="credentials">
              <p><strong>Email:</strong> ${to}</p>
              <p><strong>Temporary Password:</strong> ${tempPassword}</p>
            </div>
            <p>Please log in and change your password immediately.</p>
            <a href="${process.env.CLIENT_URL}/login" class="btn">Login to Your Account</a>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} StackAmit. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
  return sendEmail(msg);
};

export const sendOTPEmail = async (to, otp, purpose = "verification") => {
  const subjects = {
    registration: "Verify Your Email - StackAmit",
    password_reset: "Password Reset OTP - StackAmit",
    email_verification: "Email Verification - StackAmit",
  };

  const msg = {
    to,
    from: process.env.EMAIL_FROM,
    subject: subjects[purpose] || subjects.email_verification,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>
        body { font-family: 'Segoe UI', sans-serif; background: #f4f7fc; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
        .header h1 { color: #fff; margin: 0; }
        .body { padding: 30px; text-align: center; }
        .otp { font-size: 36px; font-weight: 700; color: #667eea; letter-spacing: 8px; background: #f8f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .body p { color: #555; line-height: 1.7; }
        .footer { background: #f8f9ff; padding: 20px; text-align: center; color: #888; font-size: 13px; }
      </style></head>
      <body>
        <div class="container">
          <div class="header"><h1>StackAmit</h1></div>
          <div class="body">
            <h2>Verification Code</h2>
            <p>Use the following OTP to ${purpose === "password_reset" ? "reset your password" : "verify your email"}:</p>
            <div class="otp">${otp}</div>
            <p>This code expires in 10 minutes. Do not share it with anyone.</p>
          </div>
          <div class="footer"><p>&copy; ${new Date().getFullYear()} StackAmit</p></div>
        </div>
      </body>
      </html>
    `,
  };
  return sendEmail(msg);
};

export const sendPasswordResetEmail = async (to, name, resetUrl) => {
  const msg = {
    to,
    from: process.env.EMAIL_FROM,
    subject: "Password Reset Request - StackAmit",
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>
        body { font-family: 'Segoe UI', sans-serif; background: #f4f7fc; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; }
        .header h1 { color: #fff; margin: 0; }
        .body { padding: 30px; }
        .body p { color: #555; line-height: 1.7; }
        .btn { display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .footer { background: #f8f9ff; padding: 20px; text-align: center; color: #888; font-size: 13px; }
      </style></head>
      <body>
        <div class="container">
          <div class="header"><h1>Password Reset</h1></div>
          <div class="body">
            <p>Hello ${name},</p>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <a href="${resetUrl}" class="btn">Reset Password</a>
            <p style="color: #888; font-size: 13px; margin-top: 20px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer"><p>&copy; ${new Date().getFullYear()} StackAmit</p></div>
        </div>
      </body>
      </html>
    `,
  };
  return sendEmail(msg);
};

export const sendTaskAssignedEmail = async (
  to,
  studentName,
  taskTitle,
  dueDate,
) => {
  const msg = {
    to,
    from: process.env.EMAIL_FROM,
    subject: `New Task Assigned: ${taskTitle} - StackAmit`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 12px;">
        <h2 style="color: #667eea;">New Task Assigned</h2>
        <p>Hello ${studentName},</p>
        <p>A new task has been assigned to you:</p>
        <div style="background: #f8f9ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>Task:</strong> ${taskTitle}</p>
          <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
        </div>
        <p>Please log in to view the full details and submit your work.</p>
        <a href="${process.env.CLIENT_URL}/student/tasks" style="display: inline-block; background: #667eea; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Task</a>
      </div>
    `,
  };
  return sendEmail(msg);
};

export const sendCertificateEmail = async (
  to,
  studentName,
  internshipTitle,
  certNumber,
) => {
  const msg = {
    to,
    from: process.env.EMAIL_FROM,
    subject: `Your Certificate is Ready - StackAmit`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 12px;">
        <h2 style="color: #38a169;">Certificate Issued!</h2>
        <p>Congratulations ${studentName}!</p>
        <p>Your certificate for <strong>${internshipTitle}</strong> has been generated.</p>
        <div style="background: #f0fff4; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>Certificate Number:</strong> ${certNumber}</p>
        </div>
        <p>Log in to your dashboard to download your certificate.</p>
        <a href="${process.env.CLIENT_URL}/student/certificates" style="display: inline-block; background: #38a169; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Download Certificate</a>
      </div>
    `,
  };
  return sendEmail(msg);
};

export const sendOfferLetterEmail = async (
  to,
  studentName,
  internshipTitle,
  category,
  duration,
  trainerName,
  applicationId,
  pdfBuffer = null,
  offerDate = null,
) => {
  const durationText = duration
    ? `${duration.weeks} weeks (${duration.hoursPerWeek || 20} hrs/week)`
    : "As per program schedule";
  const offerDateText = (
    offerDate ? new Date(offerDate) : new Date()
  ).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const offerLettersUrl = `${process.env.CLIENT_URL}/student/offer-letters`;

  const msg = {
    to,
    from: process.env.EMAIL_FROM,
    subject: `Internship Offer Letter - ${internshipTitle} | StackAmit`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>
        body { font-family: 'Segoe UI', sans-serif; background: #f4f7fc; margin: 0; padding: 20px; }
        .container { max-width: 620px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px 30px; text-align: center; }
        .header h1 { color: #fff; margin: 0; font-size: 26px; }
        .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 15px; }
        .body { padding: 30px; }
        .body h2 { color: #1a1a2e; margin-top: 0; }
        .body p { color: #555; line-height: 1.7; font-size: 14px; }
        .offer-box { background: #f0fff4; border: 2px solid #38ef7d; border-radius: 10px; padding: 20px; margin: 20px 0; }
        .offer-box h3 { color: #11998e; margin: 0 0 12px; font-size: 16px; }
        .offer-box table { width: 100%; border-collapse: collapse; }
        .offer-box td { padding: 6px 0; font-size: 14px; color: #555; }
        .offer-box td:first-child { font-weight: 600; color: #333; width: 160px; }
        .congrats { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 6px; margin: 20px 0; }
        .congrats p { margin: 0; color: #92400e; font-weight: 500; }
        .btn { display: inline-block; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 6px 4px 6px 0; }
        .btn-outline { display: inline-block; background: #fff; color: #11998e; border: 2px solid #11998e; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 6px 4px 6px 0; }
        .btn-group { margin: 16px 0; }
        .footer { background: #f8f9ff; padding: 20px 30px; text-align: center; color: #888; font-size: 13px; }
        .footer p { margin: 4px 0; }
      </style></head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Internship Offer Letter</h1>
            <p>StackAmit Internship Program</p>
          </div>
          <div class="body">
            <p style="font-size: 15px;">Dear <strong>${studentName}</strong>,</p>
            <div class="congrats">
              <p>Congratulations! We are pleased to offer you an internship at StackAmit.</p>
            </div>
            <p>Based on your application and profile, you have been selected to join our internship program. Below are the details of your offer:</p>

            <div class="offer-box">
              <h3>Offer Details</h3>
              <table>
                <tr><td>Position</td><td>${internshipTitle}</td></tr>
                <tr><td>Category</td><td>${category}</td></tr>
                <tr><td>Duration</td><td>${durationText}</td></tr>
                ${trainerName ? `<tr><td>Assigned Trainer</td><td>${trainerName}</td></tr>` : ""}
                <tr><td>Offer Date</td><td>${offerDateText}</td></tr>
              </table>
            </div>

            <p>As an intern at StackAmit, you will have the opportunity to work on real-world projects, receive mentorship from industry professionals, and earn a certificate upon successful completion of the program.</p>

            <p>Your official offer letter in PDF format ${pdfBuffer ? "is <strong>attached to this email</strong> - simply open or download the attachment" : "can be downloaded from your student dashboard"}.</p>

            ${pdfBuffer ? '<p style="background: #f0fff4; border: 1px solid #38ef7d; border-radius: 8px; padding: 12px 16px; color: #11998e; font-weight: 600;">&#128206; Offer-Letter.pdf is attached to this email.</p>' : ""}

            <div class="btn-group">
              <a href="${offerLettersUrl}" class="btn">View &amp; Download Offer Letters</a>
            </div>

            <div class="btn-group">
              <a href="https://chat.whatsapp.com/KT6g7vy7QeC7tXR0hPq5HR" class="btn" target="_blank" rel="noopener noreferrer">Join WhatsApp Group</a>
            </div>
            <p>Please log in to your student dashboard to view your tasks, connect with your trainer, and track your progress throughout the internship.</p>

            <p style="margin-top: 20px;">We look forward to a productive and enriching experience with you!</p>
            <p style="color: #333;"><strong>Best regards,</strong><br>Team StackAmit</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} StackAmit. All rights reserved.</p>
            <p>This is an automated email. Please do not reply directly.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  // Attach the offer letter PDF to the email when provided
  if (pdfBuffer) {
    msg.attachments = [
      {
        content: pdfBuffer.toString("base64"),
        filename: `Offer-Letter-${(studentName || "Student").replace(/\s+/g, "-")}.pdf`,
        type: "application/pdf",
        disposition: "attachment",
      },
    ];
  }

  return sendEmail(msg);
};
