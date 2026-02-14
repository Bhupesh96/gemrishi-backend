import nodemailer from 'nodemailer';

export const sendEmail = async ({ to, subject, html }) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error("Missing email credentials in environment variables.");
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"Gemstone" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);

    // console.log(`Email sent to ${to}: ${info.messageId}`);
  } catch (error) {
    console.error('Failed to send email:', error.message);
    throw new Error('Email could not be sent. Please try again later.');
  }
};
