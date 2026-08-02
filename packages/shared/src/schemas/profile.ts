/**
 * Profile schema definitions.
 * 
 * Contains the TypeScript types and validation schemas for user profiles.
 * 
 * @module profile
 */
import { z } from "zod";

/**
 * Profile type definition.
 */
export type Profile = {
    id: string;
    user_id: string | null;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    avatar: string | null;
    role: string | null;
    is_admin: boolean | null;
    created_at: string;
    updated_at: string | null;
};

/**
 * Profile validation schema.
 * 
 * Ensures that the profile object adheres to the defined structure and types.
 * 
 * @returns {z.ZodObject} The validation schema for the profile object.
 */
export const ProfileSchema = z.object({
    id: z.uuid(),
    user_id: z.uuid().nullable(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    username: z.string().nullable(),
    avatar: z.uuid().nullable(),
    role: z.string().nullable(),
    is_admin: z.boolean().nullable(),
    created_at: z.string(),
    updated_at: z.string().nullable(),
});