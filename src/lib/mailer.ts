import nodemailer from "nodemailer";

export async function getMailClient() {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "info@blenta.app",
      pass: "dXbCUJFgPyAS2dQ*12",
    },
  });

  return transporter;
}
