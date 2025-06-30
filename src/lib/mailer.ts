import nodemailer from "nodemailer";

export async function getMailClient() {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "info@blenta.app",
      pass: "mmec bpwi yihf mizx",
    },
  });

  return transporter;
}
