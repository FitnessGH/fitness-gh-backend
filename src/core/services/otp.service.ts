import { prisma } from "./prisma.service.js";

class OTPService {
  /**
   * Generate a 6-digit OTP
   */
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create and store OTP for email verification
   */
  async createEmailOTP(email: string, accountId?: string): Promise<string> {
    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing OTPs for this email
    await prisma.emailVerification.deleteMany({
      where: { email },
    });

    // Create new OTP
    await prisma.emailVerification.create({
      data: {
        email,
        otp,
        accountId,
        expiresAt,
      },
    });

    return otp;
  }

  /**
   * Verify OTP for email
   */
  async verifyEmailOTP(email: string, otp: string): Promise<boolean> {
    const verification = await prisma.emailVerification.findFirst({
      where: {
        email,
        otp,
        expiresAt: {
          gt: new Date(),
        },
        verifiedAt: null,
      },
    });

    if (!verification) {
      return false;
    }

    // Mark as verified
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { verifiedAt: new Date() },
    });

    return true;
  }

  /**
   * Check if email is already verified
   */
  async isEmailVerified(email: string): Promise<boolean> {
    const verification = await prisma.emailVerification.findFirst({
      where: {
        email,
        verifiedAt: {
          not: null,
        },
      },
    });

    return !!verification;
  }

  /**
   * Clean up expired OTPs
   */
  async cleanupExpiredOTPs(): Promise<void> {
    await prisma.emailVerification.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }

  /**
   * Generate OTP email content
   */
  generateEmailContent(otp: string): {
    subject: string;
    html: string;
    text: string;
  } {
    const subject = "Verify Your Email - Fitness GH";
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c9d9d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .otp { background: #fff; border: 2px solid #2c9d9d; padding: 15px; text-align: center; margin: 20px 0; }
          .otp-code { font-size: 32px; font-weight: bold; color: #2c9d9d; letter-spacing: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Fitness GH</h1>
            <p>Email Verification</p>
          </div>
          <div class="content">
            <p>Thank you for signing up! Please use the verification code below to verify your email address:</p>
            <div class="otp">
              <div class="otp-code">${otp}</div>
            </div>
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            <p>If you didn't request this verification, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Fitness GH. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Fitness GH - Email Verification

Thank you for signing up! Please use the verification code below to verify your email address:

Verification Code: ${otp}

This code will expire in 10 minutes.

If you didn't request this verification, please ignore this email.

© 2024 Fitness GH. All rights reserved.
    `;

    return { subject, html, text };
  }
}

export default new OTPService();
