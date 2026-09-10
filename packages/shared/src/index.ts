/**
 * Entry point for the shared package.
 *
 * Exports all shared schemas and utilities for use across different packages.
 *
 * @module @getkinlight.com/shared
 */
export * from "./schemas/profile";
export * from "./schemas/auth";
export * from "./schemas/onboarding";
export * from "./schemas/care-schedule";
export * from "./schemas/care";
export * from "./schemas/dashboard";
export * from "./schemas/family";
export * from "./schemas/ai";
export * from "./schemas/notifications";
export * from "./schemas/conversations";
export * from "./schemas/schedule-assignment";
export * from "./schemas/supply";
export * from "./schemas/tasks";
export * from "./api/client";
export * from "./supabase/client";
export * from "./supabase/server";
