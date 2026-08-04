import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type {
  CareMutationRequest,
  CareRecipient,
  FamilyWorkspaceResponse,
} from "@getkinlight.com/shared";
import { useEffect, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KinlightScreen } from "@/components/kinlight-screen";
import {
  Colors,
  Palette,
  Radius,
  Shadow,
  Spacing,
  Type,
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { createMobileApiClient } from "@/lib/api";

const views = ["members", "care"] as const;
type FamilyView = (typeof views)[number];
type ColorsValue = (typeof Colors)[keyof typeof Colors];
type IconName = ComponentProps<typeof MaterialIcons>["name"];
type FamilyMember = FamilyWorkspaceResponse["members"][number];
type HouseholdRole = NonNullable<FamilyWorkspaceResponse["currentUserRole"]>;

const roleLabels: Record<HouseholdRole, string> = {
  owner: "Owner",
  caregiver: "Caregiver",
  member: "Member",
};

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Kinlight could not load your family space.";
}

function memberName(member: FamilyMember) {
  return (
    [member.firstName, member.lastName].filter(Boolean).join(" ") ||
    member.username ||
    member.email ||
    "Household member"
  );
}

function initials(value: string) {
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function FamilyWorkspace() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const [workspace, setWorkspace] = useState<FamilyWorkspaceResponse | null>(
    null,
  );
  const [view, setView] = useState<FamilyView>("members");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [editingRecipient, setEditingRecipient] =
    useState<CareRecipient | null>(null);
  const [showRecipientEditor, setShowRecipientEditor] = useState(false);

  useEffect(() => {
    let active = true;
    createMobileApiClient()
      .familyWorkspace.get()
      .then((response) => {
        if (active) setWorkspace(response);
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function load(householdId?: string, pullToRefresh = false) {
    if (pullToRefresh) setRefreshing(true);
    else setSwitching(true);
    setError(null);
    try {
      setWorkspace(
        await createMobileApiClient().familyWorkspace.get(householdId),
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSwitching(false);
    }
  }

  const household = workspace?.selectedHousehold ?? null;
  const isOwner = workspace?.currentUserRole === "owner";
  const activeRecipients =
    workspace?.recipients.filter((recipient) => recipient.isActive) ?? [];

  return (
    <KinlightScreen
      eyebrow="Your circle"
      title={household?.name ?? "Family"}
      refreshing={refreshing}
      onRefresh={() => load(household?.id, true)}
      action={
        (view === "members" && isOwner) || (view === "care" && household) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              view === "members" ? "Invite family member" : "Add care recipient"
            }
            onPress={() => {
              if (view === "members") setShowInvite(true);
              else {
                setEditingRecipient(null);
                setShowRecipientEditor(true);
              }
            }}
            style={[styles.headerAction, { backgroundColor: colors.primary }]}
          >
            <MaterialIcons
              name={view === "members" ? "person-add" : "add"}
              size={21}
              color={colors.background}
            />
          </Pressable>
        ) : null
      }
    >
      {loading ? <Loading colors={colors} /> : null}
      {!loading && error ? (
        <MessagePanel
          icon="cloud-off"
          title="Family space unavailable"
          body={error}
          action="Try again"
          onAction={() => load(household?.id)}
          colors={colors}
        />
      ) : null}
      {!loading && !error && workspace && !household ? (
        <MessagePanel
          icon="home-work"
          title="No household yet"
          body="Finish household setup on Kinlight web, then your trusted circle will appear here."
          colors={colors}
        />
      ) : null}
      {!loading && !error && workspace && household ? (
        <>
          {workspace.households.length > 1 ? (
            <HouseholdPicker
              workspace={workspace}
              disabled={switching}
              onSelect={(id) => load(id)}
              colors={colors}
            />
          ) : null}
          <SummaryBand
            members={workspace.members.length}
            recipients={activeRecipients.length}
            invitations={workspace.invitations.length}
            role={workspace.currentUserRole}
            colors={colors}
          />
          {notice ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss message"
              onPress={() => setNotice(null)}
              style={[styles.notice, { backgroundColor: colors.surfaceMuted }]}
            >
              <MaterialIcons
                name="check-circle"
                size={18}
                color={colors.success}
              />
              <Text style={[styles.noticeText, { color: colors.text }]}>
                {notice}
              </Text>
              <MaterialIcons name="close" size={17} color={colors.icon} />
            </Pressable>
          ) : null}
          <ViewSelector view={view} onSelect={setView} colors={colors} />
          {switching ? (
            <ActivityIndicator color={colors.accent} />
          ) : view === "members" ? (
            <MemberDirectory
              workspace={workspace}
              onEdit={isOwner ? setEditingMember : undefined}
              colors={colors}
            />
          ) : (
            <RecipientDirectory
              workspace={workspace}
              onAdd={() => {
                setEditingRecipient(null);
                setShowRecipientEditor(true);
              }}
              onEdit={(recipient) => {
                setEditingRecipient(recipient);
                setShowRecipientEditor(true);
              }}
              colors={colors}
            />
          )}
        </>
      ) : null}
      {workspace?.selectedHousehold ? (
        <>
          <InviteModal
            visible={showInvite}
            householdId={workspace.selectedHousehold.id}
            onClose={() => setShowInvite(false)}
            onInvited={async (message) => {
              setShowInvite(false);
              setNotice(message);
              await load(workspace.selectedHousehold?.id);
            }}
            colors={colors}
          />
          <MemberEditorModal
            member={editingMember}
            householdId={workspace.selectedHousehold.id}
            currentUserId={workspace.currentUserId}
            onClose={() => setEditingMember(null)}
            onSaved={async (message) => {
              setEditingMember(null);
              setNotice(message);
              await load(workspace.selectedHousehold?.id);
            }}
            colors={colors}
          />
          <RecipientEditorModal
            visible={showRecipientEditor}
            householdId={workspace.selectedHousehold.id}
            recipient={editingRecipient}
            onClose={() => setShowRecipientEditor(false)}
            onSaved={async (message) => {
              setShowRecipientEditor(false);
              setNotice(message);
              await load(workspace.selectedHousehold?.id);
            }}
            colors={colors}
          />
        </>
      ) : null}
    </KinlightScreen>
  );
}

function Loading({ colors }: { colors: ColorsValue }) {
  return (
    <View style={styles.loading} accessibilityLabel="Loading family space">
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={[styles.body, { color: colors.textMuted }]}>
        Gathering your family circle...
      </Text>
    </View>
  );
}

function HouseholdPicker({
  workspace,
  disabled,
  onSelect,
  colors,
}: {
  workspace: FamilyWorkspaceResponse;
  disabled: boolean;
  onSelect: (id: string) => void;
  colors: ColorsValue;
}) {
  return (
    <View style={styles.group}>
      <Text style={[styles.overline, { color: colors.textMuted }]}>
        HOUSEHOLD
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {workspace.households.map((household) => {
          const selected = household.id === workspace.selectedHousehold?.id;
          return (
            <Pressable
              key={household.id}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(household.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.glass,
                  borderColor: selected ? colors.primary : colors.glassBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? colors.background : colors.text },
                ]}
              >
                {household.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SummaryBand({
  members,
  recipients,
  invitations,
  role,
  colors,
}: {
  members: number;
  recipients: number;
  invitations: number;
  role: HouseholdRole | null;
  colors: ColorsValue;
}) {
  return (
    <View
      style={[
        styles.summary,
        Shadow,
        { backgroundColor: colors.glass, borderColor: colors.glassBorder },
      ]}
    >
      <Metric
        value={members}
        label="Members"
        icon="groups"
        tone={Palette.aqua300}
        colors={colors}
      />
      <Metric
        value={recipients}
        label="In care"
        icon="favorite"
        tone={Palette.peach300}
        colors={colors}
      />
      <Metric
        value={invitations}
        label="Pending"
        icon="schedule"
        tone={Palette.sun300}
        colors={colors}
      />
      <View
        style={[styles.roleBadge, { backgroundColor: colors.surfaceMuted }]}
      >
        <MaterialIcons name="shield" size={15} color={colors.primary} />
        <Text style={[styles.roleText, { color: colors.primary }]}>
          {role ? roleLabels[role] : "Member"}
        </Text>
      </View>
    </View>
  );
}

function Metric({
  value,
  label,
  icon,
  tone,
  colors,
}: {
  value: number;
  label: string;
  icon: IconName;
  tone: string;
  colors: ColorsValue;
}) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: tone }]}>
        <MaterialIcons name={icon} size={18} color={Palette.navy950} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

function ViewSelector({
  view,
  onSelect,
  colors,
}: {
  view: FamilyView;
  onSelect: (view: FamilyView) => void;
  colors: ColorsValue;
}) {
  return (
    <View
      style={[
        styles.selector,
        { backgroundColor: colors.glass, borderColor: colors.glassBorder },
      ]}
    >
      {views.map((option) => {
        const selected = option === view;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(option)}
            style={[
              styles.selectorButton,
              selected && { backgroundColor: colors.glassStrong },
            ]}
          >
            <MaterialIcons
              name={option === "members" ? "group" : "favorite-outline"}
              size={18}
              color={selected ? colors.text : colors.icon}
            />
            <Text
              style={[
                styles.selectorText,
                { color: selected ? colors.text : colors.textMuted },
              ]}
            >
              {option === "members" ? "People with access" : "Care recipients"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MemberDirectory({
  workspace,
  onEdit,
  colors,
}: {
  workspace: FamilyWorkspaceResponse;
  onEdit?: (member: FamilyMember) => void;
  colors: ColorsValue;
}) {
  return (
    <Directory title="Household members" icon="verified-user" colors={colors}>
      {workspace.members.map((member) => {
        const name = memberName(member);
        const isCurrent = member.userId === workspace.currentUserId;
        return (
          <Pressable
            key={member.id}
            accessibilityRole={onEdit ? "button" : undefined}
            accessibilityLabel={onEdit ? `Edit ${name}` : undefined}
            onPress={() => onEdit?.(member)}
            style={[styles.personRow, { borderBottomColor: colors.border }]}
          >
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: isCurrent
                    ? Palette.aqua300
                    : colors.surfaceMuted,
                },
              ]}
            >
              <Text style={[styles.avatarText, { color: Palette.navy950 }]}>
                {initials(name)}
              </Text>
            </View>
            <View style={styles.personCopy}>
              <View style={styles.personHeading}>
                <Text style={[styles.personName, { color: colors.text }]}>
                  {name}
                </Text>
                {isCurrent ? (
                  <Text style={[styles.you, { color: colors.accent }]}>
                    You
                  </Text>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={[styles.personMeta, { color: colors.textMuted }]}
              >
                {member.email ?? member.username ?? "Household access"}
              </Text>
            </View>
            <View
              style={[
                styles.accessBadge,
                { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <Text style={[styles.accessText, { color: colors.primary }]}>
                {roleLabels[member.role]}
              </Text>
            </View>
            {onEdit ? (
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={colors.icon}
              />
            ) : null}
          </Pressable>
        );
      })}
      {workspace.invitations.map((invitation) => (
        <View
          key={invitation.id}
          style={[styles.personRow, { borderBottomColor: colors.border }]}
        >
          <View style={[styles.avatar, { backgroundColor: Palette.sun300 }]}>
            <MaterialIcons
              name="mail-outline"
              size={20}
              color={Palette.navy950}
            />
          </View>
          <View style={styles.personCopy}>
            <Text
              numberOfLines={1}
              style={[styles.personName, { color: colors.text }]}
            >
              {invitation.email}
            </Text>
            <Text style={[styles.personMeta, { color: colors.textMuted }]}>
              Pending {roleLabels[invitation.role].toLowerCase()} invitation
            </Text>
          </View>
        </View>
      ))}
    </Directory>
  );
}

function RecipientDirectory({
  workspace,
  onAdd,
  onEdit,
  colors,
}: {
  workspace: FamilyWorkspaceResponse;
  onAdd: () => void;
  onEdit: (recipient: CareRecipient) => void;
  colors: ColorsValue;
}) {
  return (
    <Directory
      title="People your family supports"
      icon="favorite"
      actionLabel="Add care recipient"
      onAction={onAdd}
      colors={colors}
    >
      {workspace.recipients.length ? (
        workspace.recipients.map((recipient) => {
          const name = recipient.preferredName ?? recipient.firstName;
          return (
            <Pressable
              key={recipient.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${name}`}
              onPress={() => onEdit(recipient)}
              style={[styles.personRow, { borderBottomColor: colors.border }]}
            >
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: recipient.isActive
                      ? Palette.peach300
                      : colors.surfaceMuted,
                  },
                ]}
              >
                <Text style={[styles.avatarText, { color: Palette.navy950 }]}>
                  {initials(`${name} ${recipient.lastName}`)}
                </Text>
              </View>
              <View style={styles.personCopy}>
                <Text style={[styles.personName, { color: colors.text }]}>
                  {name} {recipient.lastName}
                </Text>
                <Text style={[styles.personMeta, { color: colors.textMuted }]}>
                  {recipient.relationship ?? "Care recipient"}
                </Text>
              </View>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: recipient.isActive
                      ? colors.success
                      : colors.textMuted,
                  },
                ]}
              />
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={colors.icon}
              />
            </Pressable>
          );
        })
      ) : (
        <View style={styles.emptyList}>
          <MaterialIcons name="person-add-alt" size={28} color={colors.icon} />
          <Text style={[styles.personName, { color: colors.text }]}>
            No care recipients yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            Add a care profile to coordinate support here.
          </Text>
        </View>
      )}
    </Directory>
  );
}

function Directory({
  title,
  icon,
  actionLabel,
  onAction,
  children,
  colors,
}: {
  title: string;
  icon: IconName;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
  colors: ColorsValue;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {title}
        </Text>
        {onAction && actionLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onAction}
            style={[
              styles.directoryAction,
              { backgroundColor: colors.glassStrong },
            ]}
          >
            <MaterialIcons name="add" size={19} color={colors.primary} />
          </Pressable>
        ) : (
          <MaterialIcons name={icon} size={20} color={colors.icon} />
        )}
      </View>
      <View
        style={[
          styles.directory,
          Shadow,
          { backgroundColor: colors.glass, borderColor: colors.glassBorder },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function MemberEditorModal({
  member,
  householdId,
  currentUserId,
  onClose,
  onSaved,
  colors,
}: {
  member: FamilyMember | null;
  householdId: string;
  currentUserId: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
  colors: ColorsValue;
}) {
  const [role, setRole] = useState<HouseholdRole>(member?.role ?? "member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!member) return;
    setRole(member.role);
    setError(null);
  }, [member]);

  if (!member) return null;
  const name = memberName(member);

  async function mutate(
    input:
      | { action: "update-member-role"; role: HouseholdRole }
      | { action: "remove-member" },
  ) {
    setSaving(true);
    setError(null);
    try {
      const result = await createMobileApiClient().family({
        ...input,
        householdId,
        memberId: member!.id,
      });
      await onSaved(result.message);
    } catch (mutationError) {
      setError(errorMessage(mutationError));
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove() {
    Alert.alert(
      "Remove household member?",
      `${name} will lose access to this household and its care information.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void mutate({ action: "remove-member" }),
        },
      ],
    );
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.modalSafe, { backgroundColor: colors.background }]}
      >
        <View
          style={[styles.modalHeader, { borderBottomColor: colors.border }]}
        >
          <Pressable accessibilityRole="button" onPress={onClose}>
            <Text style={[styles.modalAction, { color: colors.textMuted }]}>
              Cancel
            </Text>
          </Pressable>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Member access
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={saving || role === member.role}
            onPress={() => void mutate({ action: "update-member-role", role })}
          >
            {saving ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text
                style={[
                  styles.modalAction,
                  {
                    color: colors.accent,
                    opacity: role === member.role ? 0.4 : 1,
                  },
                ]}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.form}>
          <View
            style={[
              styles.editorIdentity,
              {
                backgroundColor: colors.glass,
                borderColor: colors.glassBorder,
              },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: Palette.aqua300 }]}>
              <Text style={[styles.avatarText, { color: Palette.navy950 }]}>
                {initials(name)}
              </Text>
            </View>
            <View style={styles.personCopy}>
              <Text style={[styles.personName, { color: colors.text }]}>
                {name}
              </Text>
              <Text style={[styles.personMeta, { color: colors.textMuted }]}>
                {member.email ?? "Household member"}
              </Text>
            </View>
          </View>
          <Text style={[styles.formLabel, { color: colors.text }]}>
            Household role
          </Text>
          <View style={styles.roleOptions}>
            {(["owner", "caregiver", "member"] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: role === option }}
                onPress={() => setRole(option)}
                style={[
                  styles.roleOption,
                  {
                    backgroundColor:
                      role === option ? colors.primary : colors.glass,
                    borderColor:
                      role === option ? colors.primary : colors.glassBorder,
                  },
                ]}
              >
                <MaterialIcons
                  name={
                    option === "owner"
                      ? "admin-panel-settings"
                      : option === "caregiver"
                        ? "health-and-safety"
                        : "person"
                  }
                  size={20}
                  color={role === option ? colors.background : colors.text}
                />
                <View style={styles.personCopy}>
                  <Text
                    style={[
                      styles.personName,
                      {
                        color:
                          role === option ? colors.background : colors.text,
                      },
                    ]}
                  >
                    {roleLabels[option]}
                  </Text>
                  <Text
                    style={[
                      styles.personMeta,
                      {
                        color:
                          role === option
                            ? colors.background
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {option === "owner"
                      ? "Manages access and household settings"
                      : option === "caregiver"
                        ? "Coordinates care and schedules"
                        : "Participates in the family space"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
          {member.userId !== currentUserId ? (
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={confirmRemove}
              style={[styles.dangerButton, { borderColor: colors.danger }]}
            >
              <MaterialIcons
                name="person-remove"
                size={19}
                color={colors.danger}
              />
              <Text style={[styles.dangerText, { color: colors.danger }]}>
                Remove from household
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.formIntro, { color: colors.textMuted }]}>
              You cannot remove your own account from this screen.
            </Text>
          )}
          {error ? (
            <Text
              accessibilityRole="alert"
              style={[styles.formLabel, { color: colors.danger }]}
            >
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function RecipientEditorModal({
  visible,
  householdId,
  recipient,
  onClose,
  onSaved,
  colors,
}: {
  visible: boolean;
  householdId: string;
  recipient: CareRecipient | null;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
  colors: ColorsValue;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [relationship, setRelationship] = useState("");
  const [carePreferences, setCarePreferences] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setFirstName(recipient?.firstName ?? "");
    setLastName(recipient?.lastName ?? "");
    setPreferredName(recipient?.preferredName ?? "");
    setDateOfBirth(recipient?.dateOfBirth ?? "");
    setRelationship(recipient?.relationship ?? "");
    setCarePreferences(recipient?.carePreferences ?? "");
    setIsActive(recipient?.isActive ?? true);
    setError(null);
  }, [recipient, visible]);

  const valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    (!dateOfBirth || /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) &&
    !saving;

  async function save() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    const common = {
      householdId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      preferredName: preferredName.trim() || undefined,
      dateOfBirth: dateOfBirth || undefined,
      relationship: relationship.trim() || undefined,
      carePreferences: carePreferences.trim() || undefined,
    };
    const input: CareMutationRequest = recipient
      ? {
          action: "update-recipient",
          recipientId: recipient.id,
          isActive,
          ...common,
        }
      : { action: "create-recipient", ...common };
    try {
      const result = await createMobileApiClient().care(input);
      await onSaved(result.message);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.modalSafe, { backgroundColor: colors.background }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalSafe}
        >
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <Pressable accessibilityRole="button" onPress={onClose}>
              <Text style={[styles.modalAction, { color: colors.textMuted }]}>
                Cancel
              </Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {recipient ? "Edit care profile" : "Add care profile"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !valid }}
              disabled={!valid}
              onPress={() => void save()}
            >
              {saving ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text
                  style={[
                    styles.modalAction,
                    { color: colors.accent, opacity: valid ? 1 : 0.4 },
                  ]}
                >
                  Save
                </Text>
              )}
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldRow}>
              <View style={styles.fieldColumn}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  First name
                </Text>
                <EditorInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  colors={colors}
                />
              </View>
              <View style={styles.fieldColumn}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Last name
                </Text>
                <EditorInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  colors={colors}
                />
              </View>
            </View>
            <Text style={[styles.formLabel, { color: colors.text }]}>
              Preferred name
            </Text>
            <EditorInput
              value={preferredName}
              onChangeText={setPreferredName}
              placeholder="Optional"
              colors={colors}
            />
            <Text style={[styles.formLabel, { color: colors.text }]}>
              Date of birth
            </Text>
            <EditorInput
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              colors={colors}
            />
            <Text style={[styles.formLabel, { color: colors.text }]}>
              Relationship
            </Text>
            <EditorInput
              value={relationship}
              onChangeText={setRelationship}
              placeholder="Parent, partner, friend"
              colors={colors}
            />
            <Text style={[styles.formLabel, { color: colors.text }]}>
              Care preferences
            </Text>
            <EditorInput
              value={carePreferences}
              onChangeText={setCarePreferences}
              placeholder="Routines, communication, mobility, or comfort notes"
              multiline
              colors={colors}
            />
            {recipient ? (
              <View
                style={[
                  styles.activeRow,
                  {
                    borderColor: colors.glassBorder,
                    backgroundColor: colors.glass,
                  },
                ]}
              >
                <View style={styles.personCopy}>
                  <Text style={[styles.personName, { color: colors.text }]}>
                    Active care profile
                  </Text>
                  <Text
                    style={[styles.personMeta, { color: colors.textMuted }]}
                  >
                    Inactive profiles remain in family history.
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="Active care profile"
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: colors.border, true: colors.success }}
                  thumbColor={Palette.white}
                />
              </View>
            ) : null}
            {error ? (
              <Text
                accessibilityRole="alert"
                style={[styles.formLabel, { color: colors.danger }]}
              >
                {error}
              </Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function EditorInput({
  colors,
  multiline,
  ...props
}: ComponentProps<typeof TextInput> & { colors: ColorsValue }) {
  return (
    <TextInput
      {...props}
      multiline={multiline}
      placeholderTextColor={colors.textMuted}
      style={[
        styles.input,
        multiline && styles.textArea,
        {
          backgroundColor: colors.glassStrong,
          borderColor: colors.glassBorder,
          color: colors.text,
        },
      ]}
    />
  );
}

function InviteModal({
  visible,
  householdId,
  onClose,
  onInvited,
  colors,
}: {
  visible: boolean;
  householdId: string;
  onClose: () => void;
  onInvited: (message: string) => Promise<void>;
  colors: ColorsValue;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "caregiver">("member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && !saving;

  async function invite() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const result = await createMobileApiClient().family({
        action: "invite-member",
        householdId,
        email: email.trim(),
        role,
      });
      if (result.invitationToken) {
        const origin =
          process.env.EXPO_PUBLIC_KINLIGHT_API_URL?.replace(/\/$/, "") ?? "";
        await Share.share({
          message: `${origin}/family/join?token=${result.invitationToken}`,
        });
      }
      setEmail("");
      await onInvited(result.message);
    } catch (inviteError) {
      setError(errorMessage(inviteError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.modalSafe, { backgroundColor: colors.background }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalSafe}
        >
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <Pressable accessibilityRole="button" onPress={onClose}>
              <Text style={[styles.modalAction, { color: colors.textMuted }]}>
                Cancel
              </Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Invite member
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !valid }}
              disabled={!valid}
              onPress={() => void invite()}
            >
              {saving ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text
                  style={[
                    styles.modalAction,
                    { color: colors.accent, opacity: valid ? 1 : 0.4 },
                  ]}
                >
                  Invite
                </Text>
              )}
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.formIntro, { color: colors.textMuted }]}>
              Invitation links expire after seven days and only work for the
              invited email.
            </Text>
            <Text style={[styles.formLabel, { color: colors.text }]}>
              Email
            </Text>
            <TextInput
              accessibilityLabel="Invite email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="family@example.com"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                {
                  backgroundColor: colors.glassStrong,
                  borderColor: colors.glassBorder,
                  color: colors.text,
                },
              ]}
            />
            <Text style={[styles.formLabel, { color: colors.text }]}>
              Access
            </Text>
            <View style={styles.roleOptions}>
              {(["member", "caregiver"] as const).map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: role === option }}
                  onPress={() => setRole(option)}
                  style={[
                    styles.roleOption,
                    {
                      backgroundColor:
                        role === option ? colors.primary : colors.glass,
                      borderColor:
                        role === option ? colors.primary : colors.glassBorder,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={
                      option === "caregiver" ? "health-and-safety" : "person"
                    }
                    size={20}
                    color={role === option ? colors.background : colors.text}
                  />
                  <View style={styles.personCopy}>
                    <Text
                      style={[
                        styles.personName,
                        {
                          color:
                            role === option ? colors.background : colors.text,
                        },
                      ]}
                    >
                      {roleLabels[option]}
                    </Text>
                    <Text
                      style={[
                        styles.personMeta,
                        {
                          color:
                            role === option
                              ? colors.background
                              : colors.textMuted,
                        },
                      ]}
                    >
                      {option === "caregiver"
                        ? "Can coordinate care"
                        : "Shared family access"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
            {error ? (
              <Text
                accessibilityRole="alert"
                style={[styles.formLabel, { color: colors.danger }]}
              >
                {error}
              </Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function MessagePanel({
  icon,
  title,
  body,
  action,
  onAction,
  colors,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  colors: ColorsValue;
}) {
  return (
    <View
      style={[
        styles.message,
        Shadow,
        { backgroundColor: colors.glass, borderColor: colors.glassBorder },
      ]}
    >
      <MaterialIcons name={icon} size={30} color={colors.primary} />
      <Text style={[styles.messageTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
        {body}
      </Text>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.primaryText, { color: colors.background }]}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  loading: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  body: { ...Type.body },
  group: { gap: Spacing.md },
  overline: { ...Type.caption },
  chips: { gap: Spacing.sm },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
  },
  chipText: { ...Type.label },
  summary: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    overflow: "hidden",
  },
  metric: { flex: 1, alignItems: "center", gap: Spacing.xs },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: { ...Type.heading },
  metricLabel: { ...Type.caption, fontSize: 10 },
  roleBadge: {
    position: "absolute",
    right: Spacing.sm,
    top: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  roleText: { fontSize: 10, lineHeight: 12, fontWeight: "600" },
  notice: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  noticeText: { ...Type.label, flex: 1 },
  selector: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: Radius.pill,
    padding: Spacing.xs,
  },
  selectorButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
  },
  selectorText: { ...Type.caption },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { ...Type.heading },
  directoryAction: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  directory: { borderWidth: 1, borderRadius: Radius.lg, overflow: "hidden" },
  personRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...Type.label },
  personCopy: { flex: 1, gap: 2 },
  personHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  personName: { ...Type.label },
  personMeta: { ...Type.caption },
  you: { ...Type.caption },
  accessBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  accessText: { ...Type.caption },
  statusDot: { width: 10, height: 10, borderRadius: Radius.pill },
  emptyList: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  emptyBody: { ...Type.body, textAlign: "center" },
  message: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  messageTitle: { ...Type.heading, textAlign: "center" },
  primaryButton: {
    alignSelf: "stretch",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },
  primaryText: { ...Type.label },
  modalSafe: { flex: 1 },
  modalHeader: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xl,
  },
  modalTitle: { ...Type.heading },
  modalAction: { ...Type.label },
  form: { padding: Spacing.xl, gap: Spacing.md },
  formIntro: { ...Type.body, marginBottom: Spacing.sm },
  formLabel: { ...Type.label },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    ...Type.body,
  },
  textArea: {
    minHeight: 112,
    paddingTop: Spacing.md,
    textAlignVertical: "top",
  },
  fieldRow: { flexDirection: "row", gap: Spacing.md },
  fieldColumn: { flex: 1, gap: Spacing.md },
  editorIdentity: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  activeRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  dangerButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
  },
  dangerText: { ...Type.label },
  roleOptions: { gap: Spacing.sm },
  roleOption: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
});
