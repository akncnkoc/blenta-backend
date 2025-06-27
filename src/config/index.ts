import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 5151,
  jwtSecret: process.env.JWT_SECRET || "blenta-appi-key",
  dbUrl: process.env.DATABASE_URL || "",
};
