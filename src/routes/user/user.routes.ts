import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { PrismaClient } from "@prisma/client";
// import { getMailClient } from "../../lib/mailer";
import {
  confirmationEmailEn,
  confirmationEmailTr,
} from "../../lib/emails/confirmation-email";
import { addDays, addHours } from "date-fns";
import { getMailClient } from "../../lib/mailer";
import { isPaidMembership } from "../../lib/isPaidMembership";
const prisma = new PrismaClient();

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/me",
    method: "GET",
    schema: {
      tags: ["User"],
      summary: "Get current user",
      response: {
        401: z.object({ message: z.string() }),
        200: z.object({
          user: z
            .object({
              id: z.string(),
              name: z.string().nullable(),
              surname: z.string().nullable(),
              email: z.string(),
              phoneNumber: z.string().nullable(),
              gender: z.enum(["MAN", "WOMAN", "UNKNOWN"]),
              age: z.string().nullable(),
              isPaidMembership: z.boolean(),
              promotionExpiresAt: z.string().nullable(),
              isRegistered: z.boolean(),
              referenceCode: z.string(),
              userAppVersion: z.string().nullable(),
              userLikedEvents: z.array(
                z.object({
                  id: z.string(),
                  userId: z.string(),
                  eventId: z.string(),
                  event: z.object({
                    id: z.string(),
                    name: z.string().nullable(),
                    description: z.string().nullable(),
                  }),
                }),
              ),
              likedQuestions: z.array(
                z.object({
                  id: z.string(),
                  userId: z.string(),
                  questionId: z.string(),
                  question: z.object({
                    id: z.string(),
                    title: z.string(),
                  }),
                }),
              ),

              userAnsweredQuestions: z.array(
                z.object({
                  id: z.string(),
                  userId: z.string(),
                  questionId: z.string(),
                }),
              ),

              userViewedQuestions: z.array(
                z.object({
                  id: z.string(),
                  userId: z.string(),
                  questionId: z.string(),
                  viewedAt: z.date(),
                }),
              ),

              userLikedCategories: z.array(
                z.object({
                  id: z.string(),
                  userId: z.string(),
                  categoryId: z.string(),
                  category: z.object({
                    id: z.string(),
                    name: z.string(),
                  }),
                }),
              ),
            })
            .nullable(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
    handler: async (req, reply) => {
      const { id } = req.user;

      const [user, activePromotionCode] = await Promise.all([
        prisma.user.findUnique({
          where: { id },
          include: {
            likedQuestions: {
              include: {
                question: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
            userAnsweredQuestions: true,
            userLikedCategories: {
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            userViewedQuestions: true,
            userLikedEvents: {
              include: {
                event: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                  },
                },
              },
            },
          },
        }),
        prisma.userPromotionCode.findFirst({
          where: {
            userId: id,
            expiresAt: {
              gt: new Date(),
            },
          },
        }),
      ]);

      if (!user) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      if (user.isUserDeactivated) {
        return reply.status(409).send({ message: "User Deactivated" });
      }

      // First check membershipExpiresAt
      const now = new Date();
      const hasValidMembership =
        user.membershipExpiresAt && new Date(user.membershipExpiresAt) > now;

      // Determine membership status
      const isPaidMembership = hasValidMembership || !!activePromotionCode;
      const promotionExpiresAt =
        activePromotionCode?.expiresAt?.toISOString() ?? null;

      return reply.status(200).send({
        user: {
          ...user,
          isPaidMembership,
          promotionExpiresAt,
        },
      });
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/me/liked-categories",
    method: "GET",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["User"],
      summary: "Get categories liked by current user",
      response: {
        200: z.object({
          categories: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              description: z.string().nullable(),
              color: z.string(),
              isPremiumCat: z.boolean(),
              isRefCat: z.boolean(),
              type: z.enum(["QUESTION", "TEST"]),
            }),
          ),
        }),
        500: z.object({
          message: z.string(),
        }),
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.id;

      try {
        const likedCategories = await prisma.userLikedCategory.findMany({
          where: { userId },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                description: true,
                color: true,
                isPremiumCat: true,
                isRefCat: true,
                type: true,
              },
            },
          },
        });

        const categories = likedCategories.map((like) => like.category);

        reply.code(200).send({ categories });
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/me/liked-questions",
    method: "GET",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["User"],
      summary: "Get questions liked by current user",
      response: {
        200: z.object({
          questions: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              description: z.string().nullable(),
              category: z.object({
                id: z.string(),
                name: z.string(),
              }),
            }),
          ),
        }),
        500: z.object({
          message: z.string(),
        }),
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.id;

      try {
        const likedQuestions = await prisma.userLikedQuestion.findMany({
          where: { userId },
          include: {
            question: {
              select: {
                id: true,
                title: true,
                description: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        const questions = likedQuestions
          .map((like) => like.question)
          .filter((q): q is NonNullable<typeof q> => !!q); // güvenlik: null check

        reply.code(200).send({ questions });
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/me/active-membership",
    method: "POST",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["User"],
      summary: "Update paid membership details for the current user",
      body: z.object({
        paidMembershipId: z.string().min(1),
        membershipRenewedAt: z.coerce.date(), // ISO string de destekler
        membershipExpiresAt: z.coerce.date(),
        memberVendorProductId: z.string().min(1),
        memberStore: z.string().min(1),
      }),
      response: {
        200: z.object({
          message: z.string(),
          user: z.object({
            id: z.string(),
            isPaidMembership: z.boolean(), // 🔄 boolean yap
            paidMembershipId: z.string().nullable(),
            membershipRenewedAt: z.date().nullable(),
            membershipExpiresAt: z.date().nullable(),
            memberVendorProductId: z.string().nullable(),
            memberStore: z.string().nullable(),
          }),
        }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.id;
      const {
        paidMembershipId,
        membershipRenewedAt,
        membershipExpiresAt,
        memberVendorProductId,
        memberStore,
      } = req.body;

      try {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            isPaidMembership: true,
            paidMembershipId,
            membershipRenewedAt,
            membershipExpiresAt,
            memberVendorProductId,
            memberStore,
          },
          select: {
            id: true,
            isPaidMembership: true,
            paidMembershipId: true,
            membershipRenewedAt: true,
            membershipExpiresAt: true,
            memberVendorProductId: true,
            memberStore: true,
          },
        });

        reply.code(200).send({
          message: "Membership updated successfully",
          user: updatedUser,
        });
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });

  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/me/deactivate-membership",
    method: "DELETE",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["User"],
      summary: "Update paid membership details for the current user",
      response: {
        200: z.object({
          message: z.string(),
        }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.id;

      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            isPaidMembership: false,
            paidMembershipId: "",
            membershipRenewedAt: null,
            membershipExpiresAt: null,
            memberVendorProductId: "",
            memberStore: "",
          },
        });

        await prisma.userPromotionCode.updateMany({
          where: { userId: userId },
          data: { expiresAt: new Date() },
        });

        reply.code(200).send({
          message: "Membership updated successfully",
        });
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/loginWithUserEmail",
    schema: {
      tags: ["User"],
      summary: "Send OTP to user email",
      querystring: z.object({
        lang: z.string(),
      }),
      body: z.object({
        email: z.string().max(50),
      }),
      response: {
        200: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { lang } = req.query;
      const { email } = req.body;

      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        fastify.log.info("User not found, creating new user...");
        user = await prisma.user.create({
          data: {
            email,
            name: "",
            surname: "",
            password: "",
            role: "USER",
            appEnvironment: "PHONE",
            gender: "UNKNOWN",
            referenceCode: [...Array(8)]
              .map(() => Math.random().toString(36)[2].toUpperCase())
              .join(""),
          },
        });
      }

      if (user.isUserDeactivated) {
        return reply.status(409).send({ message: "User Deactivated" });
      }
      var oneTimePassCode = "";
      if (user.email == "test@apple.com") {
        oneTimePassCode = String("123456");
      } else {
        oneTimePassCode = String(Math.floor(Math.random() * 1000000)).padStart(
          6,
          "0",
        );
      }
      await prisma.userOneTimeCode.deleteMany({ where: { userId: user.id } });

      await prisma.userOneTimeCode.create({
        data: {
          userId: user.id,
          code: oneTimePassCode,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      });

      const mail = await getMailClient();
      const mailTemp =
        lang === "en"
          ? confirmationEmailEn(email, oneTimePassCode)
          : confirmationEmailTr(email, oneTimePassCode);
      if (!mailTemp) {
        return reply.status(400).send({ message: "Mail temp not foundd" });
      }

      try {
        if (user.email != "test@apple.com") {
          const result = await mail.sendMail(mailTemp);
          console.log("Mail sent successfully:", result?.response);
        }
      } catch (err) {
        console.log(err);
      }
      return reply
        .status(200)
        .send({ message: "OTP email was sent successfully" });
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/loginUserWithEmailOtp",
    method: "POST",
    schema: {
      tags: ["User"],
      summary: "Verify otp and login",
      body: z.object({
        email: z.string().max(50),
        otpCode: z.string().max(6),
      }),
      response: {
        200: z.object({ accessToken: z.string(), isRegistered: z.boolean() }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
        409: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { email, otpCode } = req.body;
      try {
        let token = "";
        let payload = {} as {
          id: string;
          email: string;
          name: string | null;
          surname: string | null;
          role: string;
          isRegistered: boolean;
          isDeactivated: boolean;
        };

        await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({
            where: { email },
          });

          if (!user) {
            throw new Error("UserNotFound");
          }

          if (user.isUserDeactivated) {
            return reply.status(409).send({ message: "User Deactivated" });
          }

          const otpCodeUser = await tx.userOneTimeCode.findFirst({
            where: {
              userId: user.id,
              code: otpCode,
            },
          });

          if (!otpCodeUser) {
            throw new Error("InvalidOtpCode");
          }

          if (otpCodeUser.expiresAt && otpCodeUser.expiresAt < new Date()) {
            throw new Error("OtpExpired");
          }

          payload = {
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            role: user.role,
            isRegistered: user.isRegistered,
            isDeactivated: user.isUserDeactivated,
          };
          token = req.jwt.sign(payload);

          reply.setCookie("access_token", token, {
            path: "/",
            httpOnly: true,
            secure: true,
          });
        });

        return reply
          .code(200)
          .send({ accessToken: token, isRegistered: payload.isRegistered });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "UserNotFound") {
            return reply.status(404).send({ message: "User not found" });
          }
          if (error.message === "InvalidOtpCode") {
            return reply.status(400).send({ message: "Invalid OTP code" });
          }
          if (error.message === "OtpExpired") {
            return reply.status(409).send({ message: "OTP code expired" });
          }
        }

        console.error("Login failed:", error);
        return reply
          .status(500)
          .send({ message: "An error occurred during login" });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/loginUserWithAppleToken",
    method: "POST",
    schema: {
      tags: ["User"],
      summary: "Verify Apple And Login",
      body: z.object({
        idToken: z.string(),
      }),
      response: {
        200: z.object({ accessToken: z.string(), isRegistered: z.boolean() }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { idToken } = req.body;

      let user = await prisma.user.findUnique({
        where: {
          icloudLoginKey: idToken,
        },
      });

      // ❗ Eğer kullanıcı yoksa oluştur
      if (!user) {
        user = await prisma.user.create({
          data: {
            gender: "UNKNOWN",
            icloudLoginKey: idToken,
            email: idToken + "@apple.id",
            appEnvironment: "PHONE",
            referenceCode: [...Array(8)]
              .map(() => Math.random().toString(36)[2].toUpperCase())
              .join(""),
          },
        });
      }

      if (user.isUserDeactivated) {
        return reply.status(409).send({ message: "User Deactivated" });
      }

      const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        role: user.role,
        isRegistered: user.isRegistered,
        isDeactivated: user.isUserDeactivated,
      };

      const token = req.jwt.sign(payload);

      reply.setCookie("access_token", token, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      });

      return { accessToken: token, isRegistered: payload.isRegistered };
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/updateAppVersion",
    method: "PUT",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["User"],
      summary: "Update user app version",
      body: z.object({
        versionCode: z.string().max(20), // adjust length/format as needed
      }),
      response: {
        200: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.id;
      const { versionCode } = req.body;

      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          return reply.code(404).send({ message: "User not found" });
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            userAppVersion: versionCode,
          },
        });

        return reply.code(200).send({ message: "App version updated" });
      } catch (error) {
        console.error("App version update failed:", error);
        return reply
          .code(500)
          .send({ message: "An error occurred while updating app version" });
      }
    },
  });

  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/deactivate-user",
    method: "PUT",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["User"],
      summary: "Deactivate current user",
      response: {
        200: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.id;

      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          return reply.code(404).send({ message: "User not found" });
        }
        if (user.isUserDeactivated) {
          return reply.code(409).send({ message: "User already deactivated" });
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            isUserDeactivated: true,
          },
        });

        return reply.code(200).send({ message: "User deactivated" });
      } catch (error) {
        return reply
          .code(500)
          .send({ message: "An error occurred while updating app version" });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/updateUserInfo",
    method: "PUT",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["User"],
      summary: "Update user info",
      body: z.object({
        name: z.string().max(50),
        surname: z.string().max(50),
        age: z.string(),
        phoneNumber: z.string(),
        gender: z.enum(["MAN", "WOMAN", "UNKNOWN"]),
      }),
      response: {
        200: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.id;

      const { name, surname, age, phoneNumber, gender } = req.body;
      try {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: userId },
          });

          if (!user) {
            throw new Error("UserNotFound");
          }

          await tx.user.update({
            where: { id: userId },
            data: {
              name,
              surname,
              age,
              phoneNumber,
              gender,
              isRegistered: true,
            },
          });
        });

        return reply.code(200).send({ message: "User updated" });
      } catch (error) {
        if (error instanceof Error && error.message === "UserNotFound") {
          return reply.code(404).send({ message: "User not found" });
        }

        console.error("Update failed:", error);
        return reply
          .code(500)
          .send({ message: "An error occurred during update" });
      }
    },
  });

  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/active-promotion-code",
    method: "PUT",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["User"],
      summary: "Active promotion code for user",
      body: z.object({
        code: z.string(),
      }),
      response: {
        200: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.id;

      const { code } = req.body;
      try {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: userId },
          });

          if (!user) {
            throw new Error("UserNotFound");
          }

          var isUserPremium = await isPaidMembership(user.id);
          if (isUserPremium) {
            throw new Error("UserAlreadyMember");
          }

          var promotionCode = await tx.promotionCode.findFirst({
            where: { code: code },
          });
          if (!promotionCode) {
            throw new Error("PromotionCodeNotFound");
          }

          var promotionCodeExists = await tx.userPromotionCode.findFirst({
            where: {
              promotionCodeId: promotionCode.id,
            },
          });
          if (promotionCodeExists) {
            throw new Error("PromotionCodeAlreadyUsed");
          }

          const now = new Date();
          const extraTimeStr = promotionCode.extraTime; // e.g. "34"

          // Parse string to integer
          const extraTime = parseInt(extraTimeStr, 10);

          if (isNaN(extraTime)) {
            throw new Error(`Invalid extraTime: ${extraTimeStr}`);
          }

          const daysToAdd = Math.floor(extraTime / 24);
          const hoursToAdd = extraTime % 24;

          let expiresAt = now;
          if (daysToAdd > 0) {
            expiresAt = addDays(expiresAt, daysToAdd);
          }
          if (hoursToAdd > 0) {
            expiresAt = addHours(expiresAt, hoursToAdd);
          }

          await tx.userPromotionCode.create({
            data: {
              userId,
              promotionCodeId: promotionCode.id,
              expiresAt,
            },
          });
        });

        return reply.code(200).send({ message: "User updated" });
      } catch (error) {
        if (error instanceof Error && error.message === "UserNotFound") {
          return reply.code(404).send({ message: "User not found" });
        }
        if (error instanceof Error && error.message === "UserAlreadyMember") {
          return reply.code(409).send({
            message:
              "Cannot use promotion code beacuse already membership activated",
          });
        }

        if (
          error instanceof Error &&
          error.message === "PromotionCodeNotFound"
        ) {
          return reply.code(404).send({ message: "Promotion Code not found" });
        }

        if (
          error instanceof Error &&
          error.message === "PromotionCodeAlreadyUsed"
        ) {
          return reply
            .code(409)
            .send({ message: "Promotion Code already used" });
        }
        console.error("Update failed:", error);
        return reply
          .code(500)
          .send({ message: "An error occurred during update" });
      }
    },
  });
}
