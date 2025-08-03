// routes/notification.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";

export default async function notificationRoutes(fastify: FastifyInstance) {
  // Helper function to make OneSignal API calls directly
  const makeOneSignalRequest = async (
    endpoint: string,
    data: any,
    method = "POST",
  ) => {
    const url = `https://onesignal.com/api/v1/${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
    };

    // Try both authentication methods
    if (process.env.ONESIGNAL_REST_API_KEY) {
      // New API key format
      headers["Authorization"] = `Basic ${process.env.ONESIGNAL_REST_API_KEY}`;
    } else if (process.env.ONESIGNAL_USER_AUTH_KEY) {
      // Legacy user auth key
      headers["Authorization"] = `Basic ${process.env.ONESIGNAL_USER_AUTH_KEY}`;
    } else {
      throw new Error("No OneSignal API key configured");
    }

    fastify.log.info("Making OneSignal request", {
      url,
      method,
      hasAuthHeader: !!headers["Authorization"],
      authKeyPrefix: headers["Authorization"]?.substring(0, 20) + "...",
    });

    const response = await fetch(url, {
      method,
      headers,
      body: method !== "GET" ? JSON.stringify(data) : undefined,
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { rawResponse: responseText };
    }

    if (!response.ok) {
      const error = new Error(
        `OneSignal API Error: ${response.status} ${response.statusText}`,
      );
      (error as any).status = response.status;
      (error as any).responseData = responseData;
      (error as any).responseText = responseText;
      throw error;
    }

    return responseData;
  };

  // Test endpoint to verify OneSignal configuration
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/test-onesignal",
    method: "GET",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Notification"],
      summary: "Test OneSignal Configuration",
    },
    handler: async (req, reply) => {
      try {
        if (!process.env.ONESIGNAL_APP_ID) {
          return reply.status(500).send({
            success: false,
            error: "ONESIGNAL_APP_ID is not configured",
          });
        }

        if (
          !process.env.ONESIGNAL_REST_API_KEY &&
          !process.env.ONESIGNAL_USER_AUTH_KEY
        ) {
          return reply.status(500).send({
            success: false,
            error:
              "No OneSignal API key configured (need either ONESIGNAL_REST_API_KEY or ONESIGNAL_USER_AUTH_KEY)",
          });
        }

        // Test with a simple API call to get app info
        const appData = await makeOneSignalRequest(
          `apps/${process.env.ONESIGNAL_APP_ID}`,
          null,
          "GET",
        );

        reply.send({
          success: true,
          message: "OneSignal configuration is valid",
          app: {
            id: appData.id,
            name: appData.name,
            players: appData.players,
          },
        });
      } catch (err: any) {
        fastify.log.error("OneSignal test failed", {
          error: err.message,
          status: err.status,
          responseData: err.responseData,
          responseText: err.responseText,
        });

        reply.status(err.status || 500).send({
          success: false,
          error: `OneSignal test failed: ${err.message}`,
          details:
            process.env.NODE_ENV === "development"
              ? {
                  status: err.status,
                  responseData: err.responseData,
                  responseText: err.responseText,
                }
              : undefined,
        });
      }
    },
  });

  // Send notification endpoint
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/send-notification",
    method: "POST",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Notification"],
      summary: "Send Notification",
      body: z.object({
        title: z.string(),
        message: z.string(),
        // subtitle: z.string().optional(),
        // Optional targeting options
        // included_segments: z.array(z.string()).default(["All"]),
        // include_player_ids: z.array(z.string()).optional(),
        // filters: z.array(z.any()).optional(),
      }),
    },
    handler: async (req, reply) => {
      const {
        title,
        message,
        // subtitle,
        // included_segments,
        // include_player_ids,
        // filters,
      } = req.body;

      try {
        if (!process.env.ONESIGNAL_APP_ID) {
          throw new Error("ONESIGNAL_APP_ID is not configured");
        }

        // Build notification payload
        const notificationPayload: any = {
          app_id: process.env.ONESIGNAL_APP_ID,
          headings: { en: title },
          contents: { en: message },
          included_segments: ["All"],
        };

        // Add optional fields
        // if (subtitle) {
        //   notificationPayload.subtitle = { en: subtitle };
        // }

        // Set targeting
        // if (include_player_ids && include_player_ids.length > 0) {
        //   notificationPayload.include_player_ids = include_player_ids;
        // } else if (filters && filters.length > 0) {
        //   notificationPayload.filters = filters;
        // } else {
        //   notificationPayload.included_segments = included_segments;
        // }

        fastify.log.info("Sending OneSignal notification", {
          app_id: process.env.ONESIGNAL_APP_ID,
          title,
          hasMessage: !!message,
          // targeting: include_player_ids
          //   ? "player_ids"
          //   : filters
          //     ? "filters"
          //     : "segments",
        });

        // Send notification using direct API call
        const response = await makeOneSignalRequest(
          "notifications",
          notificationPayload,
        );

        fastify.log.info("OneSignal notification sent successfully", {
          id: response.id,
          recipients: response.recipients,
        });

        reply.send({
          success: true,
          id: response.id,
          recipients: response.recipients,
          external_id: response.external_id,
        });
      } catch (err: any) {
        fastify.log.error("OneSignal notification failed", {
          error: err.message,
          status: err.status,
          responseData: err.responseData,
        });

        let errorMessage = err.message;
        if (err.status === 403) {
          errorMessage =
            "OneSignal API authentication failed. Please verify your API key and App ID are correct.";
        } else if (err.status === 400) {
          errorMessage =
            "Invalid notification data. Check the request payload.";
        } else if (err.status === 429) {
          errorMessage =
            "OneSignal API rate limit exceeded. Please try again later.";
        }

        reply.status(err.status || 500).send({
          success: false,
          error: errorMessage,
          details:
            process.env.NODE_ENV === "development"
              ? {
                  originalError: err.message,
                  status: err.status,
                  responseData: err.responseData,
                  responseText: err.responseText,
                }
              : undefined,
        });
      }
    },
  });

  // Endpoint to get notification history
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/notifications",
    method: "GET",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Notification"],
      summary: "Get Notification History",
      querystring: z.object({
        limit: z.coerce.number().min(1).max(50).default(10),
        offset: z.coerce.number().min(0).default(0),
      }),
    },
    handler: async (req, reply) => {
      try {
        const { limit, offset } = req.query;

        const notifications = await makeOneSignalRequest(
          `notifications?app_id=${process.env.ONESIGNAL_APP_ID}&limit=${limit}&offset=${offset}`,
          null,
          "GET",
        );

        reply.send({
          success: true,
          notifications: notifications.notifications,
          total_count: notifications.total_count,
        });
      } catch (err: any) {
        fastify.log.error("Failed to fetch notifications", err);
        reply.status(err.status || 500).send({
          success: false,
          error: "Failed to fetch notification history",
        });
      }
    },
  });
}
