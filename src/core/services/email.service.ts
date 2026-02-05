import otpService from "./otp.service.js";

interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

class EmailService {
  private smtpApiKey: string;
  private smtpServer: string;
  private smtpPort: number;

  constructor() {
    this.smtpApiKey = process.env.SMTP_KEY || '';
    this.smtpServer = process.env.SMTP_SERVER || 'smtp-relay.brevo.com';
    this.smtpPort = parseInt(process.env.SMTP_PORT || '587');
  }

  /**
   * Extract email from Brevo API key
   * Brevo API key format: xsmtpsib-{key}-{signature}
   * Email is the first part before the first dash
   */
  private extractEmailFromApiKey(): string {
    const keyParts = this.smtpApiKey.split('-');
    return keyParts[0] || '';
  }

  /**
   * Send email using Brevo SMTP
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.smtpApiKey) {
      console.warn("⚠️  SMTP_KEY not found, using mock email service");
      return this.sendMockEmail(options);
    }

    try {
      const nodemailer = await import('nodemailer');
      
      const transporter = nodemailer.createTransport({
        host: this.smtpServer,
        port: this.smtpPort,
        secure: false, // true for 465, false for other ports
        auth: {
          user: this.extractEmailFromApiKey(),
          pass: this.smtpApiKey,
        },
      });

      const mailOptions = {
        from: `"Fitness GH" <noreply@fitnessgh.com>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const result = await transporter.sendMail(mailOptions);
      
      console.log("📧 EMAIL SENT SUCCESSFULLY:");
      console.log("To:", options.to);
      console.log("Subject:", options.subject);
      console.log("Message ID:", result.messageId);
      
    } catch (error: any) {
      console.error("❌ EMAIL SENDING FAILED:", error);
      
      // Fallback to mock service on authentication or connection errors
      if (error.code === 'EAUTH' || error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
        console.warn("🔄 Falling back to mock email service due to SMTP error");
        return this.sendMockEmail(options);
      }
      
      throw new Error(`Failed to send email: ${error.message || error}`);
    }
  }

  /**
   * Mock email sending for development
   */
  private async sendMockEmail(options: EmailOptions): Promise<void> {
    console.log("📧 MOCK EMAIL SERVICE - Sending Email:");
    console.log("To:", options.to);
    console.log("Subject:", options.subject);
    console.log("HTML Length:", options.html?.length || 0);
    console.log("Text Length:", options.text?.length || 0);
    
    // In development, we'll log OTP to console for easy testing
    if (options.text?.includes("Verification Code:")) {
      const otpMatch = options.text.match(/Verification Code: (\d{6})/);
      if (otpMatch) {
        console.log("🔢 OTP FOR TESTING:", otpMatch[1]);
      }
    }

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
