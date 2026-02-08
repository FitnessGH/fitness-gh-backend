import { prisma } from "./prisma.service.js";

// Temporary in-memory store for testing
const otpStore = new Map<string, { otp: string; expiresAt: Date }>();

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
    const normalizedEmail = email.trim().toLowerCase();
    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log(`📧 [OTP Creation] Creating OTP for email: ${normalizedEmail}, accountId: ${accountId || 'none'}`);

    try {
      // Delete any existing OTPs for this email
      const deletedCount = await prisma.emailVerification.deleteMany({
        where: { email: normalizedEmail },
      });
      console.log(`🗑️ [OTP Creation] Deleted ${deletedCount.count} existing OTP records`);

      // Create new OTP
      const verification = await prisma.emailVerification.create({
        data: {
          email: normalizedEmail,
          otp,
          accountId,
          expiresAt,
        },
      });
      console.log(`✅ [OTP Creation] OTP created successfully:`, {
        id: verification.id,
        email: verification.email,
        accountId: verification.accountId,
        expiresAt: verification.expiresAt,
      });
    } catch (error) {
      console.warn("⚠️ [OTP Creation] Database OTP storage failed, using in-memory fallback:", error);
      // Fallback to in-memory storage
      otpStore.set(normalizedEmail, { otp, expiresAt });
      console.log(`💾 [OTP Creation] Stored OTP in memory for: ${normalizedEmail}`);
    }

    return otp;
  }

  /**
   * Verify OTP for email
   */
  async verifyEmailOTP(email: string, otp: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    console.log(`🔍 [OTP Verification] Starting verification for email: ${normalizedEmail}, OTP: ${otp}`);
    
    try {
      console.log(`🔍 [OTP Verification] Searching for verification record...`);
      const verification = await prisma.emailVerification.findFirst({
        where: {
          email: normalizedEmail,
          otp,
          expiresAt: {
            gt: new Date(),
          },
          verifiedAt: null,
        },
      });

      if (!verification) {
        console.log(`❌ [OTP Verification] No valid verification record found for email: ${normalizedEmail}`);
        return false;
      }

      console.log(`✅ [OTP Verification] Found verification record:`, {
        id: verification.id,
        email: verification.email,
        accountId: verification.accountId,
        expiresAt: verification.expiresAt,
      });

      // Mark as verified
      console.log(`📝 [OTP Verification] Marking emailVerification record as verified...`);
      await prisma.emailVerification.update({
        where: { id: verification.id },
        data: { verifiedAt: new Date() },
      });
      console.log(`✅ [OTP Verification] EmailVerification record updated successfully`);

      // Update account emailVerified status
      if (verification.accountId) {
        console.log(`📝 [OTP Verification] Updating account by accountId: ${verification.accountId}`);
        // Update by accountId (most reliable)
        const result = await prisma.account.update({
          where: { id: verification.accountId },
          data: { emailVerified: true },
        });
        console.log(`✅ [OTP Verification] Account updated successfully:`, {
          accountId: result.id,
          email: result.email,
          emailVerified: result.emailVerified,
        });
        return true;
      } else {
        console.log(`⚠️ [OTP Verification] No accountId in verification record, falling back to email lookup`);
        // Fallback: find account by email (stored lowercase) and update
        const account = await prisma.account.findUnique({
          where: { email: normalizedEmail },
          select: { id: true, email: true, emailVerified: true },
        });
        
        if (account) {
          console.log(`📝 [OTP Verification] Found account by email:`, {
            accountId: account.id,
            email: account.email,
            currentEmailVerified: account.emailVerified,
          });
          const result = await prisma.account.update({
            where: { id: account.id },
            data: { emailVerified: true },
          });
          console.log(`✅ [OTP Verification] Account updated successfully (fallback):`, {
            accountId: result.id,
            email: result.email,
            emailVerified: result.emailVerified,
          });
          return true;
        } else {
          console.warn(`⚠️ [OTP Verification] No account found for email: ${normalizedEmail}`);
          // Still return true if OTP was valid, but log the issue
          return true;
        }
      }

    } catch (error) {
      console.error("❌ [OTP Verification] Database OTP verification failed:", error);
      if (error instanceof Error) {
        console.error("❌ [OTP Verification] Error details:", {
          message: error.message,
          stack: error.stack,
        });
      }
      
      // Fallback to in-memory verification
      const storedOTP = otpStore.get(normalizedEmail);
      if (!storedOTP) return false;
      
      if (storedOTP.otp !== otp || storedOTP.expiresAt < new Date()) {
        otpStore.delete(normalizedEmail);
        return false;
      }
      
      // Remove OTP after successful verification
      otpStore.delete(normalizedEmail);
      return true;
    }
  }

  /**
   * Check if email is already verified
   */
  async isEmailVerified(email: string): Promise<boolean> {
    try {
      const verification = await prisma.emailVerification.findFirst({
        where: {
          email,
          verifiedAt: {
            not: null,
          },
        },
      });

      return !!verification;
    } catch (error) {
      console.warn("Database email verification check failed:", error);
      return false;
    }
  }

  /**
   * Clean up expired OTPs
   */
  async cleanupExpiredOTPs(): Promise<void> {
    try {
      await prisma.emailVerification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
    } catch (error) {
      console.warn("Database OTP cleanup failed, cleaning in-memory store:", error);
      
      // Clean up in-memory store
      const now = new Date();
      for (const [email, data] of otpStore.entries()) {
        if (data.expiresAt < now) {
          otpStore.delete(email);
        }
      }
    }
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
