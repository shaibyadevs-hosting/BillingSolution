import { type NextRequest, NextResponse } from "next/server"

// Optional nodemailer import - won't throw error if not available
let nodemailer: any = null
try {
  nodemailer = require("nodemailer")
} catch (error) {
  // nodemailer not installed - that's okay, we'll handle it gracefully
  console.log("[Email] nodemailer not available - email sending disabled")
}

// Email configuration from environment variables
const getEmailTransporter = () => {
  // If nodemailer is not available, return null
  if (!nodemailer) {
    return null
  }

  // You can configure this to use SMTP (Gmail, Outlook, etc.) or other services
  // For production, use environment variables
  const emailHost = process.env.EMAIL_HOST || "smtp.gmail.com"
  const emailPort = parseInt(process.env.EMAIL_PORT || "587")
  const emailUser = process.env.EMAIL_USER
  const emailPassword = process.env.EMAIL_PASSWORD
  const emailFrom = process.env.EMAIL_FROM || emailUser

  if (!emailUser || !emailPassword) {
    // Email credentials not configured - that's okay
    return null
  }

  try {
    return nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    })
  } catch (error) {
    // If transporter creation fails, return null instead of throwing
    console.log("[Email] Failed to create email transporter:", error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, magicLink, customerName } = body

    if (!email || !magicLink) {
      // Return success even if required fields missing - just return the link
      return NextResponse.json({
        success: false,
        message: "Email and magic link are required",
        magicLink: magicLink || null,
      })
    }

    const transporter = getEmailTransporter()
    
    // If email is not configured or nodemailer not available, return link
    if (!transporter) {
      // Email not configured - return success with link
      return NextResponse.json({
        success: true,
        message: "Magic link generated (email service not configured)",
        magicLink, // Return link so frontend can show it
      })
    }

    // Try to send email, but don't throw errors if it fails
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: "Your Login Link - Billing Solutions",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #000; color: #fff; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; background-color: #f9f9f9; }
              .button { display: inline-block; padding: 12px 30px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Billing Solutions</h1>
              </div>
              <div class="content">
                <h2>Login Link</h2>
                <p>Hello${customerName ? ` ${customerName}` : ""},</p>
                <p>You requested a login link for your account. Click the button below to log in:</p>
                <div style="text-align: center;">
                  <a href="${magicLink}" class="button">Login Now</a>
                </div>
                <p style="margin-top: 30px; font-size: 12px; color: #666;">
                  Or copy and paste this link into your browser:<br>
                  <a href="${magicLink}" style="color: #0066cc; word-break: break-all;">${magicLink}</a>
                </p>
                <p style="margin-top: 20px; font-size: 12px; color: #666;">
                  This link will expire in 1 hour for security reasons.
                </p>
                <p style="margin-top: 20px; font-size: 12px; color: #999;">
                  If you didn't request this link, please ignore this email.
                </p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Billing Solutions. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Hello${customerName ? ` ${customerName}` : ""},

You requested a login link for your account. Use the following link to log in:

${magicLink}

This link will expire in 1 hour for security reasons.

If you didn't request this link, please ignore this email.

© ${new Date().getFullYear()} Billing Solutions
        `.trim(),
      }

      await transporter.sendMail(mailOptions)

      return NextResponse.json({
        success: true,
        message: "Magic link email sent successfully",
      })
    } catch (emailError: any) {
      // Email sending failed - return success anyway with the link
      // Don't throw error, just log it and return the link
      console.log("[Email] Failed to send email (non-critical):", emailError?.message || emailError)
      
      return NextResponse.json({
        success: true,
        message: "Magic link generated (email sending failed, link available below)",
        magicLink, // Always return the link even if email fails
        emailError: emailError?.message || "Email service unavailable",
      })
    }
  } catch (error: any) {
    // Even if JSON parsing or other errors occur, return the magic link if available
    console.log("[Email] Error in email endpoint (non-critical):", error)
    
    try {
      const body = await request.json()
      const { magicLink } = body
      
      return NextResponse.json({
        success: true,
        message: "Magic link generated (service error occurred)",
        magicLink: magicLink || null,
      })
    } catch {
      // Last resort - return generic success
      return NextResponse.json({
        success: true,
        message: "Magic link service encountered an error, but link generation should still work",
      })
    }
  }
}

