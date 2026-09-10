"use client";

import { createBrowserApiClient } from "@/lib/api/client";
import type { SupplyWorkspaceData } from "@/lib/supply";
import {
  SupplyItemSchema,
  createKinlightClient,
  type SupplyItem,
} from "@getkinlight.com/shared";
import { House, Package, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./supply-workspace.module.scss";

type SupplyRow = {
  id: string;
  household_id: string;
  care_recipient_id: string | null;
  name: string;
  quantity: string | null;
  category: SupplyItem["category"];
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  created_at: string;
};

const categoryOptions: Array<{ value: SupplyItem["category"]; label: string }> = [
  { value: "general", label: "General" },
  { value: "medication", label: "Medication" },
  { value: "diapers", label: "Diapers" },
  { value: "groceries", label: "Groceries" },
  { value: "hygiene", label: "Hygiene" },
  { value: "other", label: "Other" },
];
const categoryLabels = Object.fromEntries(
  categoryOptions.map((option) => [option.value, option.label]),
) as Record<SupplyItem["category"], string>;
const filterOptions = [
  { value: "all" as const, label: "All" },
  ...categoryOptions,
];

function toItem(row: SupplyRow, existing: SupplyItem | undefined) {
  return SupplyItemSchema.parse({
    id: row.id,
    householdId: row.household_id,
    recipientId: row.care_recipient_id,
    recipientName: existing?.recipientName ?? null,
    name: row.name,
    quantity: row.quantity,
    category: row.category,
    isChecked: row.is_checked,
    checkedByName: existing?.checkedByName ?? null,
    checkedAt: row.checked_at,
    createdAt: row.created_at,
  });
}

export function SupplyWorkspace({ data }: { data: SupplyWorkspaceData }) {
  const router = useRouter();
  const [items, setItems] = useState(data.items);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState<SupplyItem["category"]>("general");
  const [recipientId, setRecipientId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState<
    SupplyItem["category"] | "all"
  >("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState("");
  const household = data.selectedHousehold;
  const householdRecipients = data.recipients.filter(
    (recipient) => recipient.householdId === household?.id,
  );

  useEffect(() => {
    if (!household) return;
    const supabase = createKinlightClient();
    const channel = supabase
      .channel(`household-supply:${household.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "household_supply_items",
          filter: `household_id=eq.${household.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id: string }).id;
            setItems((current) =>
              current.filter((item) => item.id !== removedId),
            );
            return;
          }

          const row = payload.new as SupplyRow;
          setItems((current) => {
            const existing = current.find((item) => item.id === row.id);
            const next = toItem(row, existing);
            const withoutRow = current.filter((item) => item.id !== row.id);
            return [...withoutRow, next].sort((left, right) =>
              left.isChecked === right.isChecked
                ? right.createdAt.localeCompare(left.createdAt)
                : left.isChecked
                  ? 1
                  : -1,
            );
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [household]);

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!household) return;
    setError("");
    setIsAdding(true);
    try {
      const result = await createBrowserApiClient().supply.create({
        householdId: household.id,
        recipientId: recipientId || undefined,
        name,
        quantity: quantity || undefined,
        category,
      });
      if (!result.ok || !result.item) throw new Error(result.message);
      setItems((current) => [result.item!, ...current]);
      setName("");
      setQuantity("");
      setCategory("general");
      setRecipientId("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to add this item.",
      );
    } finally {
      setIsAdding(false);
    }
  }

  async function toggleItem(item: SupplyItem) {
    if (!household) return;
    setError("");
    const nextChecked = !item.isChecked;
    setItems((current) =>
      current.map((existing) =>
        existing.id === item.id
          ? { ...existing, isChecked: nextChecked }
          : existing,
      ),
    );
    try {
      const result = await createBrowserApiClient().supply.toggle({
        householdId: household.id,
        itemId: item.id,
        isChecked: nextChecked,
      });
      if (!result.ok || !result.item) throw new Error(result.message);
      setItems((current) =>
        current.map((existing) =>
          existing.id === item.id ? result.item! : existing,
        ),
      );
    } catch (toggleError) {
      setItems((current) =>
        current.map((existing) =>
          existing.id === item.id
            ? { ...existing, isChecked: item.isChecked }
            : existing,
        ),
      );
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update this item.",
      );
    }
  }

  async function deleteItem(item: SupplyItem) {
    if (!household || !window.confirm(`Remove ${item.name}?`)) return;
    setError("");
    const previous = items;
    setItems((current) => current.filter((existing) => existing.id !== item.id));
    try {
      const result = await createBrowserApiClient().supply.remove({
        householdId: household.id,
        itemId: item.id,
      });
      if (!result.ok) throw new Error(result.message);
    } catch (deleteError) {
      setItems(previous);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to remove this item.",
      );
    }
  }

  function startEditingQuantity(item: SupplyItem) {
    setEditingId(item.id);
    setEditingQuantity(item.quantity ?? "");
  }

  async function saveQuantity(item: SupplyItem) {
    if (!household) return;
    setError("");
    const nextQuantity = editingQuantity.trim();
    setEditingId(null);
    setItems((current) =>
      current.map((existing) =>
        existing.id === item.id
          ? { ...existing, quantity: nextQuantity || null }
          : existing,
      ),
    );
    try {
      const result = await createBrowserApiClient().supply.update({
        householdId: household.id,
        itemId: item.id,
        quantity: nextQuantity,
      });
      if (!result.ok || !result.item) throw new Error(result.message);
      setItems((current) =>
        current.map((existing) =>
          existing.id === item.id ? result.item! : existing,
        ),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update this item.",
      );
    }
  }

  function changeHousehold(nextHouseholdId: string) {
    router.push(`/supply?household=${nextHouseholdId}`);
  }

  if (!household) {
    return (
      <main className={styles.emptyPage}>
        <span>
          <House size={28} aria-hidden />
        </span>
        <h1>No household yet</h1>
        <p>Create or join a household to start a shared supply list.</p>
      </main>
    );
  }

  const needed = items
    .filter((item) => !item.isChecked)
    .filter(
      (item) => activeCategory === "all" || item.category === activeCategory,
    );
  const picked = items.filter((item) => item.isChecked);
  const categoryCounts = items.reduce<Record<string, number>>((counts, item) => {
    if (item.isChecked) return counts;
    counts[item.category] = (counts[item.category] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p>Family supplies</p>
          <h1>Supply list</h1>
          <span>
            Track diapers, medication refills, and groceries for {household.name}.
          </span>
        </div>
        {data.households.length > 1 ? (
          <label className={styles.householdPicker}>
            <span>Household</span>
            <select
              value={household.id}
              onChange={(event) => changeHousehold(event.target.value)}
            >
              {data.households.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <Package size={22} aria-hidden />
        )}
      </header>

      <form onSubmit={addItem} className={styles.addForm}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Item name"
          maxLength={120}
          required
        />
        <input
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="Quantity (optional)"
          maxLength={200}
        />
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as SupplyItem["category"])
          }
        >
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {householdRecipients.length > 0 && (
          <select
            value={recipientId}
            onChange={(event) => setRecipientId(event.target.value)}
            aria-label="Care recipient"
          >
            <option value="">Household-wide</option>
            {householdRecipients.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>
                {recipient.name}
              </option>
            ))}
          </select>
        )}
        <button type="submit" disabled={isAdding}>
          <Plus size={16} aria-hidden />
          {isAdding ? "Adding..." : "Add item"}
        </button>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.categoryChips} role="tablist" aria-label="Filter by category">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={activeCategory === option.value}
            data-active={activeCategory === option.value}
            onClick={() => setActiveCategory(option.value)}
          >
            {option.label}
            {option.value !== "all" && categoryCounts[option.value] ? (
              <span>{categoryCounts[option.value]}</span>
            ) : null}
          </button>
        ))}
      </div>

      <section aria-labelledby="supply-needed-title">
        <h2 id="supply-needed-title">Needed ({needed.length})</h2>
        <ul className={styles.itemList}>
          {needed.map((item) => (
            <li key={item.id}>
              <label>
                <input
                  type="checkbox"
                  checked={item.isChecked}
                  onChange={() => toggleItem(item)}
                />
                <span>
                  <strong>{item.name}</strong>
                  <em>{categoryLabels[item.category]}</em>
                  {editingId === item.id ? (
                    <span className={styles.quantityEdit} onClick={(event) => event.preventDefault()}>
                      <input
                        autoFocus
                        value={editingQuantity}
                        onChange={(event) => setEditingQuantity(event.target.value)}
                        placeholder="Quantity"
                        maxLength={200}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void saveQuantity(item);
                          }
                        }}
                      />
                      <button type="button" onClick={() => void saveQuantity(item)}>
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}>
                        <X size={13} aria-hidden />
                      </button>
                    </span>
                  ) : (
                    item.quantity && <small>{item.quantity}</small>
                  )}
                </span>
              </label>
              <div className={styles.itemMeta}>
                {item.recipientName && <small>{item.recipientName}</small>}
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Edit quantity for ${item.name}`}
                  onClick={() => startEditingQuantity(item)}
                >
                  <Pencil size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Remove ${item.name}`}
                  onClick={() => void deleteItem(item)}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            </li>
          ))}
          {needed.length === 0 && (
            <p className={styles.emptyState}>
              {activeCategory === "all"
                ? "Nothing needed right now."
                : `No ${categoryLabels[activeCategory].toLowerCase()} items needed right now.`}
            </p>
          )}
        </ul>
      </section>

      {picked.length > 0 && (
        <section aria-labelledby="supply-picked-title">
          <h2 id="supply-picked-title">Picked up ({picked.length})</h2>
          <ul className={styles.itemList} data-checked>
            {picked.map((item) => (
              <li key={item.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={item.isChecked}
                    onChange={() => toggleItem(item)}
                  />
                  <span>
                    {item.name}
                    {item.quantity ? ` · ${item.quantity}` : ""}
                  </span>
                </label>
                <div className={styles.itemMeta}>
                  {item.checkedByName && <small>Picked up by {item.checkedByName}</small>}
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={`Remove ${item.name}`}
                    onClick={() => void deleteItem(item)}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
