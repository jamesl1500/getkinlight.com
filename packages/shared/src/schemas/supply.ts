import { z } from "zod";

const isoDateTime = z.iso.datetime({ offset: true });
const optionalText = z.string().trim().max(200).optional();
const category = z.enum([
  "medication",
  "diapers",
  "groceries",
  "hygiene",
  "general",
  "other",
]);

export const SupplyItemSchema = z.object({
  id: z.uuid(),
  householdId: z.uuid(),
  recipientId: z.uuid().nullable(),
  recipientName: z.string().nullable(),
  name: z.string(),
  quantity: z.string().nullable(),
  category,
  isChecked: z.boolean(),
  checkedByName: z.string().nullable(),
  checkedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
});

export const CreateSupplyItemRequestSchema = z.object({
  householdId: z.uuid(),
  recipientId: z.uuid().optional(),
  name: z.string().trim().min(1, "Name this supply item.").max(120),
  quantity: optionalText,
  category: category.default("general"),
});

export const ToggleSupplyItemRequestSchema = z
  .object({
    householdId: z.uuid(),
    itemId: z.uuid(),
    isChecked: z.boolean().optional(),
    name: z.string().trim().min(1, "Name this supply item.").max(120).optional(),
    quantity: optionalText,
    category: category.optional(),
  })
  .refine(
    (data) =>
      data.isChecked !== undefined ||
      data.name !== undefined ||
      data.quantity !== undefined ||
      data.category !== undefined,
    { message: "Nothing to update." },
  );

export const DeleteSupplyItemRequestSchema = z.object({
  householdId: z.uuid(),
  itemId: z.uuid(),
});

export const DeleteSupplyItemResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

export const SupplyListResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  items: z.array(SupplyItemSchema),
  households: z.array(z.object({ id: z.uuid(), name: z.string() })),
  recipients: z.array(
    z.object({ id: z.uuid(), householdId: z.uuid(), name: z.string() }),
  ),
});

export const SupplyItemResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  item: SupplyItemSchema.nullable(),
});

export type SupplyItem = z.infer<typeof SupplyItemSchema>;
export type CreateSupplyItemRequest = z.infer<
  typeof CreateSupplyItemRequestSchema
>;
export type ToggleSupplyItemRequest = z.infer<
  typeof ToggleSupplyItemRequestSchema
>;
export type DeleteSupplyItemRequest = z.infer<
  typeof DeleteSupplyItemRequestSchema
>;
export type DeleteSupplyItemResponse = z.infer<
  typeof DeleteSupplyItemResponseSchema
>;
export type SupplyListResponse = z.infer<typeof SupplyListResponseSchema>;
export type SupplyItemResponse = z.infer<typeof SupplyItemResponseSchema>;
