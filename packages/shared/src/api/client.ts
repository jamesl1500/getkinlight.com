import { z, type ZodType } from "zod";
import {
  AiRequestSchema,
  AiResponseSchema,
  type AiRequest,
  type AiResponse,
} from "../schemas/ai";
import {
  AuthRequestSchema,
  AuthResponseSchema,
  DeleteAccountRequestSchema,
  DeleteAccountResponseSchema,
  type AuthRequest,
  type AuthResponse,
  type DeleteAccountRequest,
  type DeleteAccountResponse,
} from "../schemas/auth";
import {
  CareScheduleRangeQuerySchema,
  CareScheduleRangeResponseSchema,
  CreateCareScheduleRequestSchema,
  CreateCareScheduleResponseSchema,
  UpdateFamilyEventRequestSchema,
  UpdateFamilyEventResponseSchema,
  type CreateCareScheduleRequest,
  type CreateCareScheduleResponse,
  type CareScheduleRangeResponse,
  type UpdateFamilyEventRequest,
  type UpdateFamilyEventResponse,
} from "../schemas/care-schedule";
import {
  CareMutationRequestSchema,
  CareMutationResponseSchema,
  CareWorkspaceResponseSchema,
  type CareMutationRequest,
  type CareMutationResponse,
  type CareWorkspaceResponse,
} from "../schemas/care";
import {
  DashboardResponseSchema,
  type DashboardResponse,
} from "../schemas/dashboard";
import {
  FamilyMutationRequestSchema,
  FamilyMutationResponseSchema,
  FamilyWorkspaceResponseSchema,
  type FamilyMutationRequest,
  type FamilyMutationResponse,
  type FamilyWorkspaceResponse,
} from "../schemas/family";
import {
  OnboardingRequestSchema,
  OnboardingResponseSchema,
  type OnboardingRequest,
  type OnboardingResponse,
} from "../schemas/onboarding";
import {
  MarkNotificationsReadRequestSchema,
  MarkNotificationsReadResponseSchema,
  NotificationDeviceRequestSchema,
  NotificationDeviceResponseSchema,
  NotificationListResponseSchema,
  type MarkNotificationsReadRequest,
  type MarkNotificationsReadResponse,
  type NotificationDeviceRequest,
  type NotificationDeviceResponse,
  type NotificationListResponse,
} from "../schemas/notifications";
import {
  ClaimScheduleTaskRequestSchema,
  ClaimScheduleTaskResponseSchema,
  ScheduleTaskAssignmentListResponseSchema,
  type ClaimScheduleTaskRequest,
  type ClaimScheduleTaskResponse,
  type ScheduleTaskAssignmentListResponse,
} from "../schemas/schedule-assignment";
import {
  CreateSupplyItemRequestSchema,
  DeleteSupplyItemRequestSchema,
  DeleteSupplyItemResponseSchema,
  SupplyItemResponseSchema,
  SupplyListResponseSchema,
  ToggleSupplyItemRequestSchema,
  type CreateSupplyItemRequest,
  type DeleteSupplyItemRequest,
  type DeleteSupplyItemResponse,
  type SupplyItemResponse,
  type SupplyListResponse,
  type ToggleSupplyItemRequest,
} from "../schemas/supply";
import {
  ConversationWorkspaceResponseSchema,
  type ConversationWorkspaceResponse,
} from "../schemas/conversations";
import {
  TaskBoardResponseSchema,
  type TaskBoardResponse,
} from "../schemas/tasks";

export const KINLIGHT_API_VERSION = "v1" as const;

export const KinlightApiErrorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
  "NETWORK_ERROR",
  "INVALID_RESPONSE",
]);

export type KinlightApiErrorCode = z.infer<typeof KinlightApiErrorCodeSchema>;

const VersionedErrorSchema = z
  .object({
    ok: z.literal(false),
    message: z.string(),
    code: KinlightApiErrorCodeSchema,
    requestId: z.string().optional(),
  })
  .passthrough();

export class KinlightApiError extends Error {
  constructor(
    message: string,
    readonly code: KinlightApiErrorCode,
    readonly status: number,
    readonly requestId?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "KinlightApiError";
  }
}

export type KinlightApiClientOptions = {
  baseUrl?: string;
  getAccessToken?: () => Promise<string | null> | string | null;
  fetch?: typeof globalThis.fetch;
};

type RequestOptions<Input, Output> = {
  path: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  input?: Input;
  inputSchema?: ZodType<Input>;
  outputSchema: ZodType<Output>;
  accessToken?: string | null;
  requiresAuth?: boolean;
};

function errorCodeForStatus(status: number): KinlightApiErrorCode {
  if (status === 401) return "AUTH_REQUIRED";
  if (status === 403) return "FORBIDDEN";
  if (status === 409) return "CONFLICT";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  if (status >= 500) return "INTERNAL_ERROR";
  return "VALIDATION_ERROR";
}

export function createKinlightApiClient(
  options: KinlightApiClientOptions = {},
) {
  const baseUrl = options.baseUrl?.replace(/\/$/, "") ?? "";
  const fetchImpl = options.fetch ?? globalThis.fetch;

  async function request<Input, Output>({
    path,
    method,
    input,
    inputSchema,
    outputSchema,
    accessToken,
    requiresAuth = true,
  }: RequestOptions<Input, Output>): Promise<Output> {
    const token = accessToken ?? (await options.getAccessToken?.()) ?? null;
    if (requiresAuth && !token) {
      throw new KinlightApiError(
        "Your session has expired. Sign in again.",
        "AUTH_REQUIRED",
        401,
      );
    }

    const body =
      inputSchema && input !== undefined ? inputSchema.parse(input) : input;
    let response: Response;
    try {
      response = await fetchImpl(
        `${baseUrl}/api/${KINLIGHT_API_VERSION}/${path}`,
        {
          method,
          headers: {
            Accept: "application/json",
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
      );
    } catch (cause) {
      throw new KinlightApiError(
        "Unable to reach Kinlight. Check your connection and try again.",
        "NETWORK_ERROR",
        0,
        undefined,
        { cause },
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (cause) {
      throw new KinlightApiError(
        "Kinlight returned an unreadable response.",
        "INVALID_RESPONSE",
        response.status,
        response.headers.get("x-request-id") ?? undefined,
        { cause },
      );
    }

    if (!response.ok) {
      const parsed = VersionedErrorSchema.safeParse(payload);
      const fallback = payload as { message?: unknown };
      throw new KinlightApiError(
        parsed.success
          ? parsed.data.message
          : typeof fallback?.message === "string"
            ? fallback.message
            : "Kinlight could not complete that request.",
        parsed.success ? parsed.data.code : errorCodeForStatus(response.status),
        response.status,
        parsed.success
          ? parsed.data.requestId
          : (response.headers.get("x-request-id") ?? undefined),
      );
    }

    const parsed = outputSchema.safeParse(payload);
    if (!parsed.success) {
      throw new KinlightApiError(
        "Kinlight returned an unexpected response.",
        "INVALID_RESPONSE",
        response.status,
        response.headers.get("x-request-id") ?? undefined,
        { cause: parsed.error },
      );
    }
    return parsed.data;
  }

  return {
    auth(input: AuthRequest): Promise<AuthResponse> {
      return request({
        path: "auth",
        method: "POST",
        input,
        inputSchema: AuthRequestSchema,
        outputSchema: AuthResponseSchema,
        requiresAuth: false,
      });
    },
    account: {
      delete(input: DeleteAccountRequest): Promise<DeleteAccountResponse> {
        return request({
          path: "account",
          method: "PATCH",
          input,
          inputSchema: DeleteAccountRequestSchema,
          outputSchema: DeleteAccountResponseSchema,
        });
      },
    },
    onboarding: {
      get(): Promise<OnboardingResponse> {
        return request({
          path: "onboarding",
          method: "GET",
          outputSchema: OnboardingResponseSchema,
        });
      },
      async save(
        input: Omit<OnboardingRequest, "accessToken">,
      ): Promise<OnboardingResponse> {
        const accessToken = (await options.getAccessToken?.()) ?? null;
        if (!accessToken) {
          throw new KinlightApiError(
            "Your session has expired. Sign in again.",
            "AUTH_REQUIRED",
            401,
          );
        }
        return request({
          path: "onboarding",
          method: "POST",
          input: { ...input, accessToken },
          inputSchema: OnboardingRequestSchema,
          outputSchema: OnboardingResponseSchema,
          accessToken,
        });
      },
    },
    dashboard: {
      get(date?: string): Promise<DashboardResponse> {
        const path = date
          ? `dashboard?date=${encodeURIComponent(date)}`
          : "dashboard";
        return request({
          path,
          method: "GET",
          outputSchema: DashboardResponseSchema,
        });
      },
    },
    notifications: {
      get(): Promise<NotificationListResponse> {
        return request({
          path: "notifications",
          method: "GET",
          outputSchema: NotificationListResponseSchema,
        });
      },
      markRead(
        input: MarkNotificationsReadRequest,
      ): Promise<MarkNotificationsReadResponse> {
        return request({
          path: "notifications",
          method: "PATCH",
          input,
          inputSchema: MarkNotificationsReadRequestSchema,
          outputSchema: MarkNotificationsReadResponseSchema,
        });
      },
      updateDevice(
        input: NotificationDeviceRequest,
      ): Promise<NotificationDeviceResponse> {
        return request({
          path: "notifications/devices",
          method: "PATCH",
          input,
          inputSchema: NotificationDeviceRequestSchema,
          outputSchema: NotificationDeviceResponseSchema,
        });
      },
    },
    care(input: CareMutationRequest): Promise<CareMutationResponse> {
      return request({
        path: "care",
        method: "POST",
        input,
        inputSchema: CareMutationRequestSchema,
        outputSchema: CareMutationResponseSchema,
      });
    },
    careWorkspace: {
      get(recipientId?: string): Promise<CareWorkspaceResponse> {
        const path = recipientId
          ? `care?recipient=${encodeURIComponent(recipientId)}`
          : "care";
        return request({
          path,
          method: "GET",
          outputSchema: CareWorkspaceResponseSchema,
        });
      },
    },
    family(input: FamilyMutationRequest): Promise<FamilyMutationResponse> {
      return request({
        path: "family",
        method: "POST",
        input,
        inputSchema: FamilyMutationRequestSchema,
        outputSchema: FamilyMutationResponseSchema,
      });
    },
    familyWorkspace: {
      get(householdId?: string): Promise<FamilyWorkspaceResponse> {
        const path = householdId
          ? `family?household=${encodeURIComponent(householdId)}`
          : "family";
        return request({
          path,
          method: "GET",
          outputSchema: FamilyWorkspaceResponseSchema,
        });
      },
    },
    schedule: {
      getRange(start: string, end: string): Promise<CareScheduleRangeResponse> {
        const range = CareScheduleRangeQuerySchema.parse({ start, end });
        return request({
          path: `care-schedule?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`,
          method: "GET",
          outputSchema: CareScheduleRangeResponseSchema,
        });
      },
      create(
        input: CreateCareScheduleRequest,
      ): Promise<CreateCareScheduleResponse> {
        return request({
          path: "care-schedule",
          method: "POST",
          input,
          inputSchema: CreateCareScheduleRequestSchema,
          outputSchema: CreateCareScheduleResponseSchema,
        });
      },
      updateEvent(
        input: UpdateFamilyEventRequest,
      ): Promise<UpdateFamilyEventResponse> {
        return request({
          path: "care-schedule",
          method: "PATCH",
          input,
          inputSchema: UpdateFamilyEventRequestSchema,
          outputSchema: UpdateFamilyEventResponseSchema,
        });
      },
      claimTask(
        input: ClaimScheduleTaskRequest,
      ): Promise<ClaimScheduleTaskResponse> {
        return request({
          path: "schedule-assignments",
          method: "POST",
          input,
          inputSchema: ClaimScheduleTaskRequestSchema,
          outputSchema: ClaimScheduleTaskResponseSchema,
        });
      },
      getAssignments(
        householdId?: string,
      ): Promise<ScheduleTaskAssignmentListResponse> {
        const path = householdId
          ? `schedule-assignments?household=${encodeURIComponent(householdId)}`
          : "schedule-assignments";
        return request({
          path,
          method: "GET",
          outputSchema: ScheduleTaskAssignmentListResponseSchema,
        });
      },
    },
    supply: {
      get(householdId?: string): Promise<SupplyListResponse> {
        const path = householdId
          ? `supply?household=${encodeURIComponent(householdId)}`
          : "supply";
        return request({
          path,
          method: "GET",
          outputSchema: SupplyListResponseSchema,
        });
      },
      create(input: CreateSupplyItemRequest): Promise<SupplyItemResponse> {
        return request({
          path: "supply",
          method: "POST",
          input,
          inputSchema: CreateSupplyItemRequestSchema,
          outputSchema: SupplyItemResponseSchema,
        });
      },
      toggle(input: ToggleSupplyItemRequest): Promise<SupplyItemResponse> {
        return request({
          path: "supply",
          method: "PATCH",
          input,
          inputSchema: ToggleSupplyItemRequestSchema,
          outputSchema: SupplyItemResponseSchema,
        });
      },
      update(input: ToggleSupplyItemRequest): Promise<SupplyItemResponse> {
        return request({
          path: "supply",
          method: "PATCH",
          input,
          inputSchema: ToggleSupplyItemRequestSchema,
          outputSchema: SupplyItemResponseSchema,
        });
      },
      remove(input: DeleteSupplyItemRequest): Promise<DeleteSupplyItemResponse> {
        return request({
          path: "supply",
          method: "DELETE",
          input,
          inputSchema: DeleteSupplyItemRequestSchema,
          outputSchema: DeleteSupplyItemResponseSchema,
        });
      },
    },
    ai(input: AiRequest): Promise<AiResponse> {
      return request({
        path: "ai",
        method: "POST",
        input,
        inputSchema: AiRequestSchema,
        outputSchema: AiResponseSchema,
      });
    },
    conversations: {
      get(householdId?: string): Promise<ConversationWorkspaceResponse> {
        const path = householdId
          ? `conversations?household=${encodeURIComponent(householdId)}`
          : "conversations";
        return request({
          path,
          method: "GET",
          outputSchema: ConversationWorkspaceResponseSchema,
        });
      },
    },
    tasks: {
      get(householdId?: string): Promise<TaskBoardResponse> {
        const path = householdId
          ? `tasks?household=${encodeURIComponent(householdId)}`
          : "tasks";
        return request({
          path,
          method: "GET",
          outputSchema: TaskBoardResponseSchema,
        });
      },
    },
  };
}

export type KinlightApiClient = ReturnType<typeof createKinlightApiClient>;
