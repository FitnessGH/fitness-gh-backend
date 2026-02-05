import otpService from "./otp.service.js";

interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

class EmailService {
  /**
   * Send email (mock implementation for now)
   * In production, integrate with real email service like SendGrid, Nodemailer, etc.
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    // Mock email sending - log to console for development
    console.log("📧 EMAIL SERVICE - Sending Email:");
    console.log("To:", options.to);
    console.log("Subject:", options.subject);
    console.log("HTML Length:", options.html?.length || 0);
    console.log("Text Length:", options.text?.length || 0);
    
    // In development, we'll just log the OTP to console
    if (options.text?.includes("Verification Code:")) {
      const otpMatch = options.text.match(/Verification Code: (\d{6})/);
      if (otpMatch) {
        console.log("🔢 OTP FOR TESTING:", otpMatch[1]);
      }
    }

    // TODO: Implement real email service
    // Examples:
    // - SendGrid: await sgMail.send(msg)
    // - Nodemailer: await transporter.sendMail(mailOptions)
    // - AWS SES: await ses.sendEmail(params).promise()
    
    // Simulate email delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Send OTP verification email
   */
  async sendVerificationEmail(email: string, otp: string): Promise<void> {
    const { subject, html, text } = otpService.generateEmailContent(otp);
    
    await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  /**
   * Send welcome email after successful verification
   */
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const subject = "Welcome to Fitness GH! 🎉";
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Fitness GH</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c9d9d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Fitness GH</h1>
            <p>Welcome Aboard!</p>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>Welcome to Fitness GH! Your account has been successfully created and verified.</p>
            <p>You can now:</p>
            <ul>
              <li>Access your dashboard</li>
              <li>Join fitness classes</li>
              <li>Track your progress</li>
              <li>Connect with the community</li>
            </ul>
            <p>Get started by logging in to your account!</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Fitness GH. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to Fitness GH!

Hi ${name},

Welcome to Fitness GH! Your account has been successfully created and verified.

You can now:
- Access your dashboard
- Join fitness classes  
- Track your progress
- Connect with the community

Get started by logging in to your account!

© 2024 Fitness GH. All rights reserved.
    `;

    await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }
}

export default new EmailService();
