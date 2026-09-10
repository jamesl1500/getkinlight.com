import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { SupplyItem, SupplyListResponse } from "@getkinlight.com/shared";
import { SupplyItemSchema } from "@getkinlight.com/shared";
import { useEffect, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KinlightScreen } from "@/components/kinlight-screen";
import {
  Colors,
  Radius,
  Shadow,
  Spacing,
  Type,
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { createMobileApiClient } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";

type ColorsValue = (typeof Colors)[keyof typeof Colors];
type IconName = ComponentProps<typeof MaterialIcons>["name"];
type Category = SupplyItem["category"];
type SupplyRow = {
  id: string;
  household_id: string;
  care_recipient_id: string | null;
  name: string;
  quantity: string | null;
  category: Category;
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  created_at: string;
};

const categoryOptions: { value: Category; label: string; icon: IconName }[] = [
  { value: "general", label: "General", icon: "inventory-2" },
  { value: "medication", label: "Medication", icon: "medication" },
  { value: "diapers", label: "Diapers", icon: "baby-changing-station" },
  { value: "groceries", label: "Groceries", icon: "local-grocery-store" },
  { value: "hygiene", label: "Hygiene", icon: "soap" },
  { value: "other", label: "Other", icon: "more-horiz" },
];
const categoryLabels = Object.fromEntries(
  categoryOptions.map((option) => [option.value, option.label]),
) as Record<Category, string>;
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

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Kinlight could not load the supply list.";
}

export function SupplyWorkspace() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const [workspace, setWorkspace] = useState<SupplyListResponse | null>(null);
  const [householdId, setHouseholdId] = useState("");
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | "all">(
    "all",
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState("");

  async function load(nextHouseholdId?: string, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await createMobileApiClient().supply.get(
        nextHouseholdId ?? householdId ?? undefined,
      );
      setWorkspace(result);
      setItems(result.items);
      setHouseholdId(result.households[0]?.id ?? "");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!householdId) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`household-supply:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "household_supply_items",
          filter: `household_id=eq.${householdId}`,
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
            return [...current.filter((item) => item.id !== row.id), next];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId]);

  async function toggleItem(item: SupplyItem) {
    const nextChecked = !item.isChecked;
    setItems((current) =>
      current.map((existing) =>
        existing.id === item.id
          ? { ...existing, isChecked: nextChecked }
          : existing,
      ),
    );
    try {
      const result = await createMobileApiClient().supply.toggle({
        householdId,
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
      setError(errorMessage(toggleError));
    }
  }

  function confirmDelete(item: SupplyItem) {
    Alert.alert("Remove item", `Remove ${item.name} from the supply list?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void deleteItem(item),
      },
    ]);
  }

  async function deleteItem(item: SupplyItem) {
    const previous = items;
    setItems((current) => current.filter((existing) => existing.id !== item.id));
    try {
      const result = await createMobileApiClient().supply.remove({
        householdId,
        itemId: item.id,
      });
      if (!result.ok) throw new Error(result.message);
    } catch (deleteError) {
      setItems(previous);
      setError(errorMessage(deleteError));
    }
  }

  function startEditing(item: SupplyItem) {
    setEditingId(item.id);
    setEditingQuantity(item.quantity ?? "");
  }

  async function saveQuantity(item: SupplyItem) {
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
      const result = await createMobileApiClient().supply.update({
        householdId,
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
      setError(errorMessage(updateError));
    }
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
    <KinlightScreen
      eyebrow="Family supplies"
      title="Supply list"
      refreshing={refreshing}
      onRefresh={() => void load(undefined, true)}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add supply item"
          disabled={!workspace?.households.length}
          onPress={() => setShowAdd(true)}
          style={[
            styles.addButton,
            {
              backgroundColor: colors.primary,
              opacity: !workspace?.households.length ? 0.4 : 1,
            },
          ]}
        >
          <MaterialIcons name="add" size={22} color={colors.background} />
        </Pressable>
      }
    >
      {loading ? (
        <View style={styles.loading} accessibilityLabel="Loading supply list">
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : null}

      {!loading && error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}

      {!loading && workspace && !workspace.households.length ? (
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Create or join a household to start a shared supply list.
        </Text>
      ) : null}

      {!loading && workspace && workspace.households.length > 0 ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {filterOptions.map((option) => {
              const selected = activeCategory === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveCategory(option.value)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.glass,
                      borderColor: selected ? colors.primary : colors.glassBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { color: selected ? colors.background : colors.textMuted },
                    ]}
                  >
                    {option.label}
                    {option.value !== "all" && categoryCounts[option.value]
                      ? ` (${categoryCounts[option.value]})`
                      : ""}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Needed ({needed.length})
          </Text>
          {needed.length === 0 ? (
            <Text style={[styles.body, { color: colors.textMuted }]}>
              Nothing needed right now.
            </Text>
          ) : null}
          {needed.map((item) => (
            <View
              key={item.id}
              style={[
                styles.card,
                Shadow,
                { backgroundColor: colors.glass, borderColor: colors.glassBorder },
              ]}
            >
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.isChecked }}
                onPress={() => void toggleItem(item)}
                style={[styles.checkbox, { borderColor: colors.accent }]}
              />
              <View style={styles.cardBody}>
                <Text style={[styles.itemName, { color: colors.text }]}>
                  {item.name}
                </Text>
                <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                  {categoryLabels[item.category]}
                  {item.recipientName ? ` · ${item.recipientName}` : ""}
                </Text>
                {editingId === item.id ? (
                  <View style={styles.editRow}>
                    <TextInput
                      autoFocus
                      value={editingQuantity}
                      onChangeText={setEditingQuantity}
                      placeholder="Quantity"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.editInput, { color: colors.text, borderColor: colors.glassBorder }]}
                    />
                    <Pressable onPress={() => void saveQuantity(item)}>
                      <Text style={[styles.saveText, { color: colors.accent }]}>
                        Save
                      </Text>
                    </Pressable>
                  </View>
                ) : item.quantity ? (
                  <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                    {item.quantity}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.name}`}
                onPress={() => startEditing(item)}
                style={styles.iconButton}
              >
                <MaterialIcons name="edit" size={18} color={colors.icon} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name}`}
                onPress={() => confirmDelete(item)}
                style={styles.iconButton}
              >
                <MaterialIcons name="delete-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          ))}

          {picked.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Picked up ({picked.length})
              </Text>
              {picked.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.glass,
                      borderColor: colors.glassBorder,
                      opacity: 0.65,
                    },
                  ]}
                >
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.isChecked }}
                    onPress={() => void toggleItem(item)}
                    style={[
                      styles.checkbox,
                      { borderColor: colors.accent, backgroundColor: colors.accent },
                    ]}
                  />
                  <View style={styles.cardBody}>
                    <Text style={[styles.itemName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    {item.checkedByName ? (
                      <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                        Picked up by {item.checkedByName}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.name}`}
                    onPress={() => confirmDelete(item)}
                    style={styles.iconButton}
                  >
                    <MaterialIcons
                      name="delete-outline"
                      size={18}
                      color={colors.danger}
                    />
                  </Pressable>
                </View>
              ))}
            </>
          ) : null}
        </>
      ) : null}

      {workspace ? (
        <AddSupplyItemModal
          visible={showAdd}
          householdId={householdId}
          households={workspace.households}
          recipients={workspace.recipients.filter(
            (recipient) => recipient.householdId === householdId,
          )}
          onClose={() => setShowAdd(false)}
          onCreated={(item) => {
            setItems((current) => [item, ...current]);
            setShowAdd(false);
          }}
          colors={colors}
        />
      ) : null}
    </KinlightScreen>
  );
}

function AddSupplyItemModal({
  visible,
  householdId,
  recipients,
  onClose,
  onCreated,
  colors,
}: {
  visible: boolean;
  householdId: string;
  households: SupplyListResponse["households"];
  recipients: SupplyListResponse["recipients"];
  onClose: () => void;
  onCreated: (item: SupplyItem) => void;
  colors: ColorsValue;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [recipientId, setRecipientId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setSaving(true);
    try {
      const result = await createMobileApiClient().supply.create({
        householdId,
        recipientId: recipientId || undefined,
        name,
        quantity: quantity || undefined,
        category,
      });
      if (!result.ok || !result.item) throw new Error(result.message);
      onCreated(result.item);
      setName("");
      setQuantity("");
      setCategory("general");
      setRecipientId("");
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalBackdrop}
      >
        <SafeAreaView
          style={[styles.modalCard, { backgroundColor: colors.background }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Add supply item
            </Text>
            <Pressable accessibilityRole="button" onPress={onClose}>
              <MaterialIcons name="close" size={22} color={colors.icon} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Item name"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.text, borderColor: colors.glassBorder }]}
            />
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              placeholder="Quantity (optional)"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.text, borderColor: colors.glassBorder }]}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {categoryOptions.map((option) => {
                const selected = category === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setCategory(option.value)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.glass,
                        borderColor: selected ? colors.primary : colors.glassBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        { color: selected ? colors.background : colors.textMuted },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {recipients.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {[{ id: "", name: "Household-wide" }, ...recipients].map(
                  (recipient) => {
                    const selected = recipientId === recipient.id;
                    return (
                      <Pressable
                        key={recipient.id || "household"}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setRecipientId(recipient.id)}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: selected
                              ? colors.primary
                              : colors.glass,
                            borderColor: selected
                              ? colors.primary
                              : colors.glassBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterText,
                            {
                              color: selected
                                ? colors.background
                                : colors.textMuted,
                            },
                          ]}
                        >
                          {recipient.name}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </ScrollView>
            ) : null}
            {error ? (
              <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={saving || !name.trim()}
              onPress={() => void submit()}
              style={[
                styles.submitButton,
                {
                  backgroundColor: colors.primary,
                  opacity: saving || !name.trim() ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.submitText, { color: colors.background }]}>
                {saving ? "Adding..." : "Add item"}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: Spacing["2xl"], alignItems: "center" },
  error: { ...Type.caption, marginBottom: Spacing.sm },
  body: { ...Type.body },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  filterChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  filterText: { ...Type.caption, fontWeight: "700" },
  sectionTitle: { ...Type.heading, marginTop: Spacing.lg, marginBottom: Spacing.xs },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 2,
  },
  cardBody: { flex: 1, gap: 2 },
  itemName: { ...Type.label },
  itemMeta: { ...Type.caption },
  editRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    fontSize: 14,
  },
  saveText: { ...Type.label },
  iconButton: { padding: Spacing.xs },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10, 20, 35, 0.4)",
  },
  modalCard: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
  },
  modalTitle: { ...Type.heading },
  modalBody: { padding: Spacing.lg, paddingTop: 0, gap: Spacing.md },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
  },
  submitButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  submitText: { ...Type.label },
});
