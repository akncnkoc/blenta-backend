"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMailClient = getMailClient;
const nodemailer_1 = __importDefault(require("nodemailer"));
async function getMailClient() {
    const transporter = nodemailer_1.default.createTransport({
        service: "gmail",
        auth: {
            user: "info@blenta.app",
            pass: "mmec bpwi yihf mizx",
        },
    });
    return transporter;
}
