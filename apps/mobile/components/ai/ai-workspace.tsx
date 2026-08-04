import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  AiRequestSchema,
  CreateCareScheduleRequestSchema,
  type AiChatMessage,
  type AiDailyBrief,
  type AiDocumentExtraction,
  type AiHandoff,
  type AiRequest,
  type AiScheduleProposal,
  type AiSearchAnswer,
  type CareRecipient,
  type CreateCareScheduleRequest,
  type FamilyWorkspaceResponse,
} from "@getkinlight.com/shared";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KinlightBackdrop } from "@/components/kinlight-screen";
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

type ColorsValue = (typeof Colors)[keyof typeof Colors];
type IconName = ComponentProps<typeof MaterialIcons>["name"];
type Mode = "conversation" | "tools";
type Tool = "brief" | "capture" | "handoff" | "search" | "document";
type SupportedMediaType = Extract<
  AiRequest,
  { action: "document-extract" }
>["mediaType"];

const welcomeMessage: AiChatMessage = {
  role: "assistant",
  content:
    "What would you like to understand or organize for your family today?",
};
const initialPrompts = [
  "What needs attention today?",
  "Summarize recent care updates",
  "What is coming up this week?",
];
const supportedMedia = new Set<SupportedMediaType>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Kinlight AI could not complete that request.";
}

async function askKinlight(input: AiRequest) {
  const result = await createMobileApiClient().ai(input);
  if (!result.ok) throw new Error(result.message);
  return result;
}

function scheduleRequest(
  proposal: AiScheduleProposal,
): CreateCareScheduleRequest {
  const base = {
    householdId: proposal.householdId,
    recipientId: proposal.recipientId ?? undefined,
    date: proposal.date,
    time: proposal.time,
    title: proposal.title,
    notes: proposal.notes ?? undefined,
  };
  const request =
    proposal.type === "event"
      ? {
          ...base,
          type: proposal.type,
          location: proposal.location ?? undefined,
          isAllDay: proposal.isAllDay,
        }
      : proposal.type === "appointment"
        ? {
            ...base,
            type: proposal.type,
            providerName: proposal.providerName ?? undefined,
            location: proposal.location ?? undefined,
          }
        : proposal.type === "medication"
          ? {
              ...base,
              type: proposal.type,
              dosage: proposal.dosage ?? undefined,
            }
          : {
              ...base,
              type: proposal.type,
              mealType: proposal.mealType ?? "meal",
            };
  return CreateCareScheduleRequestSchema.parse(request);
}

export function AiWorkspace() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const [workspace, setWorkspace] = useState<FamilyWorkspaceResponse | null>(
    null,
  );
  const [householdId, setHouseholdId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await createMobileApiClient().familyWorkspace.get(
        householdId || undefined,
      );
      setWorkspace(result);
      setHouseholdId(result.selectedHousehold?.id ?? "");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    createMobileApiClient()
      .familyWorkspace.get()
      .then((result) => {
        if (!active) return;
        setWorkspace(result);
        setHouseholdId(result.selectedHousehold?.id ?? "");
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <KinlightBackdrop />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Opening your family intelligence tools...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!workspace?.selectedHousehold) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <KinlightBackdrop />
        <View style={styles.loading}>
          <MaterialIcons name="auto-awesome" size={34} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>
            Kinlight AI
          </Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            {error ||
              "Create a household before using family intelligence tools."}
          </Text>
          {error ? (
            <PrimaryButton
              label="Try again"
              onPress={() => void load()}
              colors={colors}
            />
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AiExperience
      workspace={workspace}
      householdId={householdId}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      onHouseholdChange={async (nextId) => {
        setHouseholdId(nextId);
        setLoading(true);
        try {
          const result =
            await createMobileApiClient().familyWorkspace.get(nextId);
          setWorkspace(result);
        } catch (reason) {
          setError(errorMessage(reason));
        } finally {
          setLoading(false);
        }
      }}
      colors={colors}
    />
  );
}

function AiExperience({
  workspace,
  householdId,
  refreshing,
  onRefresh,
  onHouseholdChange,
  colors,
}: {
  workspace: FamilyWorkspaceResponse;
  householdId: string;
  refreshing: boolean;
  onRefresh: () => void;
  onHouseholdChange: (householdId: string) => Promise<void>;
  colors: ColorsValue;
}) {
  const [mode, setMode] = useState<Mode>("conversation");
  const [messages, setMessages] = useState<AiChatMessage[]>([welcomeMessage]);
  const [draft, setDraft] = useState("");
  const [suggestedPrompts, setSuggestedPrompts] = useState(initialPrompts);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const conversation = useRef<ScrollView>(null);

  async function sendMessage(prompt = draft) {
    const content = prompt.trim();
    if (!content || busy) return;
    const userMessage: AiChatMessage = { role: "user", content };
    const requestMessages = [...messages, userMessage].slice(-12);
    setMessages(requestMessages);
    setDraft("");
    setNotice("");
    setBusy("conversation");
    try {
      const result = await askKinlight({
        action: "conversation",
        householdId,
        messages: requestMessages,
      });
      if (result.action !== "conversation")
        throw new Error("Kinlight AI returned an unexpected response.");
      setMessages(
        (current) =>
          [
            ...current,
            { role: "assistant", content: result.data.answer },
          ].slice(-12) as AiChatMessage[],
      );
      setSuggestedPrompts(result.data.suggestedPrompts);
    } catch (reason) {
      setNotice(errorMessage(reason));
    } finally {
      setBusy("");
    }
  }

  function changeHousehold(nextId: string) {
    if (nextId === householdId || busy) return;
    setMessages([welcomeMessage]);
    setSuggestedPrompts(initialPrompts);
    setNotice("");
    void onHouseholdChange(nextId);
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <KinlightBackdrop />
      <View style={styles.header}>
        <View style={[styles.brandIcon, { backgroundColor: colors.primary }]}>
          <MaterialIcons
            name="auto-awesome"
            size={22}
            color={colors.background}
          />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            Family intelligence
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Kinlight AI
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh AI workspace"
          disabled={refreshing || Boolean(busy)}
          onPress={onRefresh}
          style={[
            styles.iconButton,
            {
              backgroundColor: colors.glassStrong,
              borderColor: colors.glassBorder,
            },
          ]}
        >
          {refreshing ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <MaterialIcons name="refresh" size={21} color={colors.primary} />
          )}
        </Pressable>
      </View>
      {workspace.households.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.households}
        >
          {workspace.households.map((household) => (
            <Pressable
              key={household.id}
              accessibilityRole="button"
              accessibilityState={{ selected: household.id === householdId }}
              onPress={() => changeHousehold(household.id)}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    household.id === householdId
                      ? colors.primary
                      : colors.glass,
                  borderColor:
                    household.id === householdId
                      ? colors.primary
                      : colors.glassBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color:
                      household.id === householdId
                        ? colors.background
                        : colors.text,
                  },
                ]}
              >
                {household.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View
        style={[
          styles.segmented,
          { backgroundColor: colors.glass, borderColor: colors.glassBorder },
        ]}
      >
        {(["conversation", "tools"] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === item }}
            onPress={() => setMode(item)}
            style={[
              styles.segment,
              mode === item && { backgroundColor: colors.glassStrong },
            ]}
          >
            <MaterialIcons
              name={item === "conversation" ? "forum" : "construction"}
              size={17}
              color={mode === item ? colors.primary : colors.icon}
            />
            <Text
              style={[
                styles.segmentText,
                { color: mode === item ? colors.text : colors.textMuted },
              ]}
            >
              {item === "conversation" ? "Conversation" : "AI tools"}
            </Text>
          </Pressable>
        ))}
      </View>
      {notice ? <Notice message={notice} colors={colors} /> : null}
      {mode === "conversation" ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={96}
          style={styles.flex}
        >
          <ScrollView
            ref={conversation}
            onContentSizeChange={() =>
              conversation.current?.scrollToEnd({ animated: true })
            }
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((message, index) => (
              <View
                key={`${message.role}-${index}`}
                style={[
                  styles.message,
                  message.role === "user"
                    ? styles.userMessage
                    : styles.assistantMessage,
                  {
                    backgroundColor:
                      message.role === "user"
                        ? colors.primary
                        : colors.glassStrong,
                    borderColor:
                      message.role === "user"
                        ? colors.primary
                        : colors.glassBorder,
                  },
                ]}
              >
                {message.role === "assistant" ? (
                  <MaterialIcons
                    name="auto-awesome"
                    size={16}
                    color={colors.accent}
                  />
                ) : null}
                <Text
                  style={[
                    styles.messageText,
                    {
                      color:
                        message.role === "user"
                          ? colors.background
                          : colors.text,
                    },
                  ]}
                >
                  {message.content}
                </Text>
              </View>
            ))}
            {busy === "conversation" ? (
              <View
                style={[
                  styles.thinking,
                  { backgroundColor: colors.glassStrong },
                ]}
              >
                <ActivityIndicator color={colors.accent} />
                <Text style={[styles.caption, { color: colors.textMuted }]}>
                  Reviewing family records...
                </Text>
              </View>
            ) : null}
            {!busy ? (
              <View style={styles.prompts}>
                {suggestedPrompts.map((prompt) => (
                  <Pressable
                    key={prompt}
                    onPress={() => void sendMessage(prompt)}
                    style={[
                      styles.prompt,
                      {
                        borderColor: colors.glassBorder,
                        backgroundColor: colors.glass,
                      },
                    ]}
                  >
                    <Text style={[styles.caption, { color: colors.text }]}>
                      {prompt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>
          <View
            style={[
              styles.composer,
              {
                backgroundColor: colors.glass,
                borderColor: colors.glassBorder,
              },
            ]}
          >
            <TextInput
              accessibilityLabel="Message Kinlight AI"
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask about your family records"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[styles.composerInput, { color: colors.text }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!draft.trim() || Boolean(busy)}
              onPress={() => void sendMessage()}
              style={[
                styles.sendButton,
                {
                  backgroundColor:
                    draft.trim() && !busy ? colors.primary : colors.border,
                },
              ]}
            >
              <MaterialIcons
                name="arrow-upward"
                size={21}
                color={colors.background}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <ToolsPanel
          householdId={householdId}
          recipients={workspace.recipients}
          busy={busy}
          setBusy={setBusy}
          setNotice={setNotice}
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
}

function ToolsPanel({
  householdId,
  recipients,
  busy,
  setBusy,
  setNotice,
  colors,
}: {
  householdId: string;
  recipients: CareRecipient[];
  busy: string;
  setBusy: (value: string) => void;
  setNotice: (value: string) => void;
  colors: ColorsValue;
}) {
  const [tool, setTool] = useState<Tool>("brief");
  const [brief, setBrief] = useState<AiDailyBrief | null>(null);
  const [captureText, setCaptureText] = useState("");
  const [proposal, setProposal] = useState<AiScheduleProposal | null>(null);
  const [recipientId, setRecipientId] = useState("");
  const [handoff, setHandoff] = useState<AiHandoff | null>(null);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<AiSearchAnswer | null>(null);
  const [document, setDocument] = useState<AiDocumentExtraction | null>(null);

  async function run<T>(
    name: string,
    operation: () => Promise<T>,
    apply: (value: T) => void,
  ) {
    setBusy(name);
    setNotice("");
    try {
      apply(await operation());
    } catch (reason) {
      setNotice(errorMessage(reason));
    } finally {
      setBusy("");
    }
  }

  async function saveProposal(
    nextProposal: AiScheduleProposal,
    afterSave: () => void,
  ) {
    setBusy("save");
    setNotice("");
    try {
      const result = await createMobileApiClient().schedule.create(
        scheduleRequest(nextProposal),
      );
      if (!result.ok) throw new Error(result.message);
      setNotice(result.message);
      afterSave();
    } catch (reason) {
      setNotice(errorMessage(reason));
    } finally {
      setBusy("");
    }
  }

  async function pickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "application/pdf",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      if ((asset.size ?? 0) > 10_000_000) {
        setNotice("Choose a file smaller than 10 MB.");
        return;
      }
      if (
        !asset.mimeType ||
        !supportedMedia.has(asset.mimeType as SupportedMediaType)
      ) {
        setNotice("Choose a JPEG, PNG, GIF, WebP, or PDF file.");
        return;
      }
      await run(
        "document",
        async () => {
          const base64 = asset.base64 ?? (await new File(asset.uri).base64());
          const request = AiRequestSchema.parse({
            action: "document-extract",
            householdId,
            recipientId: recipientId || null,
            fileName: asset.name,
            mediaType: asset.mimeType,
            base64,
          });
          const response = await askKinlight(request);
          if (response.action !== "document-extract")
            throw new Error("Kinlight AI returned an unexpected response.");
          return response.data;
        },
        setDocument,
      );
    } catch (reason) {
      setNotice(errorMessage(reason));
    }
  }

  const tools: { id: Tool; label: string; icon: IconName }[] = [
    { id: "brief", label: "Brief", icon: "auto-awesome" },
    { id: "capture", label: "Schedule", icon: "event-available" },
    { id: "handoff", label: "Handoff", icon: "group-work" },
    { id: "search", label: "Search", icon: "search" },
    { id: "document", label: "Document", icon: "document-scanner" },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.toolsContent}
      keyboardShouldPersistTaps="handled"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolTabs}
      >
        {tools.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setTool(item.id)}
            style={[
              styles.toolTab,
              {
                backgroundColor:
                  tool === item.id ? colors.primary : colors.glass,
                borderColor:
                  tool === item.id ? colors.primary : colors.glassBorder,
              },
            ]}
          >
            <MaterialIcons
              name={item.icon}
              size={17}
              color={tool === item.id ? colors.background : colors.icon}
            />
            <Text
              style={[
                styles.caption,
                { color: tool === item.id ? colors.background : colors.text },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {tool === "brief" ? (
        <ToolCard
          eyebrow="Start here"
          title="Daily family brief"
          icon="auto-awesome"
          colors={colors}
        >
          <Text style={[styles.body, { color: colors.textMuted }]}>
            A focused view of today&apos;s schedule, recent changes, and
            patterns worth reviewing.
          </Text>
          <PrimaryButton
            label={
              busy === "brief"
                ? "Preparing..."
                : brief
                  ? "Refresh brief"
                  : "Generate brief"
            }
            disabled={Boolean(busy)}
            onPress={() =>
              void run(
                "brief",
                async () => {
                  const response = await askKinlight({
                    action: "daily-brief",
                    householdId,
                    date: localDate(),
                    refresh: Boolean(brief),
                  });
                  if (response.action !== "daily-brief")
                    throw new Error(
                      "Kinlight AI returned an unexpected response.",
                    );
                  return response.data;
                },
                setBrief,
              )
            }
            colors={colors}
          />
          {brief ? <BriefResult brief={brief} colors={colors} /> : null}
        </ToolCard>
      ) : null}
      {tool === "capture" ? (
        <ToolCard
          eyebrow="Type naturally"
          title="Quick schedule capture"
          icon="event-available"
          colors={colors}
        >
          <EditorInput
            value={captureText}
            onChangeText={setCaptureText}
            multiline
            placeholder="Mom has a cardiology appointment Friday at 2 PM with Dr. Lee."
            colors={colors}
          />
          <PrimaryButton
            label={busy === "capture" ? "Reading..." : "Create draft"}
            disabled={Boolean(busy) || captureText.trim().length < 3}
            onPress={() =>
              void run(
                "capture",
                async () => {
                  const response = await askKinlight({
                    action: "capture-schedule",
                    householdId,
                    text: captureText,
                    today: localDate(),
                    timeZone:
                      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
                  });
                  if (response.action !== "capture-schedule")
                    throw new Error(
                      "Kinlight AI returned an unexpected response.",
                    );
                  return response.data;
                },
                setProposal,
              )
            }
            colors={colors}
          />
          {proposal ? (
            <ProposalCard
              proposal={proposal}
              recipients={recipients}
              disabled={Boolean(busy)}
              onSave={() =>
                void saveProposal(proposal, () => {
                  setProposal(null);
                  setCaptureText("");
                })
              }
              colors={colors}
            />
          ) : null}
        </ToolCard>
      ) : null}
      {tool === "handoff" ? (
        <ToolCard
          eyebrow="Share context"
          title="Caregiver handoff"
          icon="group-work"
          colors={colors}
        >
          <RecipientPicker
            recipients={recipients}
            value={recipientId}
            onChange={setRecipientId}
            colors={colors}
          />
          <PrimaryButton
            label={busy === "handoff" ? "Preparing..." : "Build handoff"}
            disabled={Boolean(busy)}
            onPress={() =>
              void run(
                "handoff",
                async () => {
                  const response = await askKinlight({
                    action: "handoff",
                    householdId,
                    recipientId: recipientId || null,
                  });
                  if (response.action !== "handoff")
                    throw new Error(
                      "Kinlight AI returned an unexpected response.",
                    );
                  return response.data;
                },
                setHandoff,
              )
            }
            colors={colors}
          />
          {handoff ? <HandoffResult handoff={handoff} colors={colors} /> : null}
        </ToolCard>
      ) : null}
      {tool === "search" ? (
        <ToolCard
          eyebrow="Use your records"
          title="Household search"
          icon="search"
          colors={colors}
        >
          <EditorInput
            value={query}
            onChangeText={setQuery}
            placeholder="When is Dad's next appointment?"
            colors={colors}
          />
          <PrimaryButton
            label={busy === "search" ? "Searching..." : "Ask Kinlight"}
            disabled={Boolean(busy) || query.trim().length < 2}
            onPress={() =>
              void run(
                "search",
                async () => {
                  const response = await askKinlight({
                    action: "search",
                    householdId,
                    query,
                  });
                  if (response.action !== "search")
                    throw new Error(
                      "Kinlight AI returned an unexpected response.",
                    );
                  return response.data;
                },
                setAnswer,
              )
            }
            colors={colors}
          />
          {answer ? (
            <ResultSurface colors={colors}>
              <Text style={[styles.body, { color: colors.text }]}>
                {answer.answer}
              </Text>
              {answer.insufficientContext ? (
                <Text style={[styles.caution, { color: colors.danger }]}>
                  More context is needed.
                </Text>
              ) : null}
              <Disclaimer text={answer.disclaimer} colors={colors} />
            </ResultSurface>
          ) : null}
        </ToolCard>
      ) : null}
      {tool === "document" ? (
        <ToolCard
          eyebrow="Review before saving"
          title="Document intake"
          icon="document-scanner"
          colors={colors}
        >
          <RecipientPicker
            recipients={recipients}
            value={recipientId}
            onChange={setRecipientId}
            colors={colors}
          />
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Appointment card, care instructions, discharge summary, or
            medication label. Maximum 10 MB.
          </Text>
          <PrimaryButton
            label={
              busy === "document" ? "Reading document..." : "Choose document"
            }
            disabled={Boolean(busy)}
            onPress={() => void pickDocument()}
            colors={colors}
            icon="upload-file"
          />
          {document ? (
            <DocumentResult
              document={document}
              recipients={recipients}
              disabled={Boolean(busy)}
              onSave={
                document.scheduleProposal
                  ? () =>
                      void saveProposal(document.scheduleProposal!, () =>
                        setDocument(null),
                      )
                  : undefined
              }
              colors={colors}
            />
          ) : null}
        </ToolCard>
      ) : null}
    </ScrollView>
  );
}

function ToolCard({
  eyebrow,
  title,
  icon,
  colors,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: IconName;
  colors: ColorsValue;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.toolCard,
        Shadow,
        { backgroundColor: colors.glass, borderColor: colors.glassBorder },
      ]}
    >
      <View style={styles.toolHeader}>
        <View
          style={[styles.toolIcon, { backgroundColor: colors.glassStrong }]}
        >
          <MaterialIcons name={icon} size={21} color={colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            {eyebrow}
          </Text>
          <Text style={[styles.heading, { color: colors.text }]}>{title}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function BriefResult({
  brief,
  colors,
}: {
  brief: AiDailyBrief;
  colors: ColorsValue;
}) {
  return (
    <ResultSurface colors={colors}>
      <Text style={[styles.heading, { color: colors.text }]}>
        {brief.greeting}
      </Text>
      <Text style={[styles.body, { color: colors.text }]}>{brief.summary}</Text>
      <ResultList title="Priorities" items={brief.priorities} colors={colors} />
      <ResultList title="What changed" items={brief.changes} colors={colors} />
      {brief.insights.map((insight) => (
        <View
          key={`${insight.title}-${insight.detail}`}
          style={[
            styles.insight,
            {
              borderLeftColor:
                insight.severity === "urgent"
                  ? colors.danger
                  : insight.severity === "attention"
                    ? Palette.peach500
                    : colors.success,
            },
          ]}
        >
          <Text style={[styles.label, { color: colors.text }]}>
            {insight.title}
          </Text>
          <Text style={[styles.caption, { color: colors.textMuted }]}>
            {insight.detail}
          </Text>
        </View>
      ))}
      <Disclaimer text={brief.disclaimer} colors={colors} />
    </ResultSurface>
  );
}

function HandoffResult({
  handoff,
  colors,
}: {
  handoff: AiHandoff;
  colors: ColorsValue;
}) {
  return (
    <ResultSurface colors={colors}>
      <Text style={[styles.heading, { color: colors.text }]}>
        {handoff.title}
      </Text>
      <Text style={[styles.body, { color: colors.text }]}>
        {handoff.summary}
      </Text>
      <ResultList title="Wellbeing" items={handoff.wellbeing} colors={colors} />
      <ResultList
        title="Medications"
        items={handoff.medications}
        colors={colors}
      />
      <ResultList title="Upcoming" items={handoff.upcoming} colors={colors} />
      <ResultList title="Follow up" items={handoff.followUps} colors={colors} />
      <Disclaimer text={handoff.disclaimer} colors={colors} />
    </ResultSurface>
  );
}

function DocumentResult({
  document,
  recipients,
  disabled,
  onSave,
  colors,
}: {
  document: AiDocumentExtraction;
  recipients: CareRecipient[];
  disabled: boolean;
  onSave?: () => void;
  colors: ColorsValue;
}) {
  return (
    <ResultSurface colors={colors}>
      <Text
        style={[
          styles.heading,
          { color: colors.text, textTransform: "capitalize" },
        ]}
      >
        {document.documentType.replaceAll("_", " ")}
      </Text>
      <Text style={[styles.body, { color: colors.text }]}>
        {document.summary}
      </Text>
      <ResultList
        title="Extracted instructions"
        items={document.instructions}
        colors={colors}
      />
      <ResultList
        title="Review carefully"
        items={document.warnings}
        colors={colors}
      />
      {document.scheduleProposal && onSave ? (
        <ProposalCard
          proposal={document.scheduleProposal}
          recipients={recipients}
          disabled={disabled}
          onSave={onSave}
          colors={colors}
        />
      ) : null}
      <Disclaimer text={document.disclaimer} colors={colors} />
    </ResultSurface>
  );
}

function ResultList({
  title,
  items,
  colors,
}: {
  title: string;
  items: string[];
  colors: ColorsValue;
}) {
  if (!items.length) return null;
  return (
    <View style={styles.resultList}>
      <Text style={[styles.label, { color: colors.text }]}>{title}</Text>
      {items.map((item) => (
        <View key={item} style={styles.listItem}>
          <View style={[styles.bullet, { backgroundColor: colors.accent }]} />
          <Text
            style={[styles.body, styles.listText, { color: colors.textMuted }]}
          >
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ProposalCard({
  proposal,
  recipients,
  disabled,
  onSave,
  colors,
}: {
  proposal: AiScheduleProposal;
  recipients: CareRecipient[];
  disabled: boolean;
  onSave: () => void;
  colors: ColorsValue;
}) {
  const recipient = recipients.find((item) => item.id === proposal.recipientId);
  return (
    <View
      style={[
        styles.proposal,
        {
          backgroundColor: colors.glassStrong,
          borderColor: colors.glassBorder,
        },
      ]}
    >
      <View style={styles.headerCopy}>
        <Text style={[styles.label, { color: colors.text }]}>
          {proposal.title}
        </Text>
        <Text style={[styles.caption, { color: colors.textMuted }]}>
          {proposal.date} at {proposal.time}
          {recipient
            ? ` · ${recipient.preferredName ?? recipient.firstName}`
            : ""}
        </Text>
        {proposal.needsReview.map((item) => (
          <Text key={item} style={[styles.caption, { color: colors.danger }]}>
            {item}
          </Text>
        ))}
      </View>
      <PrimaryButton
        label={disabled ? "Saving..." : "Confirm & save"}
        disabled={disabled}
        onPress={onSave}
        colors={colors}
      />
    </View>
  );
}

function RecipientPicker({
  recipients,
  value,
  onChange,
  colors,
}: {
  recipients: CareRecipient[];
  value: string;
  onChange: (value: string) => void;
  colors: ColorsValue;
}) {
  return (
    <View style={styles.recipientPicker}>
      <Pressable
        onPress={() => onChange("")}
        style={[
          styles.recipientOption,
          {
            backgroundColor: !value ? colors.primary : colors.glassStrong,
            borderColor: !value ? colors.primary : colors.glassBorder,
          },
        ]}
      >
        <Text
          style={[
            styles.caption,
            { color: !value ? colors.background : colors.text },
          ]}
        >
          Whole household
        </Text>
      </Pressable>
      {recipients.map((recipient) => {
        const selected = value === recipient.id;
        return (
          <Pressable
            key={recipient.id}
            onPress={() => onChange(recipient.id)}
            style={[
              styles.recipientOption,
              {
                backgroundColor: selected ? colors.primary : colors.glassStrong,
                borderColor: selected ? colors.primary : colors.glassBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.caption,
                { color: selected ? colors.background : colors.text },
              ]}
            >
              {recipient.preferredName ?? recipient.firstName}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ResultSurface({
  colors,
  children,
}: {
  colors: ColorsValue;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.result,
        {
          backgroundColor: colors.glassStrong,
          borderColor: colors.glassBorder,
        },
      ]}
    >
      {children}
    </View>
  );
}

function Disclaimer({ text, colors }: { text: string; colors: ColorsValue }) {
  return (
    <Text style={[styles.disclaimer, { color: colors.textMuted }]}>{text}</Text>
  );
}

function Notice({ message, colors }: { message: string; colors: ColorsValue }) {
  return (
    <View
      accessibilityRole="alert"
      style={[styles.notice, { backgroundColor: colors.glassStrong }]}
    >
      <MaterialIcons name="info-outline" size={18} color={colors.accent} />
      <Text style={[styles.caption, styles.listText, { color: colors.text }]}>
        {message}
      </Text>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  colors,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  colors: ColorsValue;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.primaryButton,
        { backgroundColor: disabled ? colors.border : colors.primary },
      ]}
    >
      {icon ? (
        <MaterialIcons name={icon} size={19} color={colors.background} />
      ) : null}
      {disabled && label.endsWith("...") ? (
        <ActivityIndicator color={colors.background} />
      ) : null}
      <Text style={[styles.label, { color: colors.background }]}>{label}</Text>
    </Pressable>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, overflow: "hidden" },
  flex: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  header: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  headerCopy: { flex: 1, gap: 2 },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { ...Type.caption, textTransform: "uppercase" },
  title: { ...Type.title },
  heading: { ...Type.heading },
  body: { ...Type.body },
  label: { ...Type.label },
  caption: { ...Type.caption },
  households: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  chip: {
    minHeight: 38,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
  },
  chipText: { ...Type.label },
  segmented: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: Radius.pill,
    padding: Spacing.xs,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: Radius.pill,
  },
  segmentText: { ...Type.caption },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  messages: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  message: {
    maxWidth: "88%",
    flexDirection: "row",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  userMessage: { alignSelf: "flex-end" },
  assistantMessage: { alignSelf: "flex-start" },
  messageText: { ...Type.body, flexShrink: 1 },
  thinking: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  prompts: { gap: Spacing.sm },
  prompt: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.xl,
    marginBottom: 96,
    padding: Spacing.sm,
  },
  composerInput: {
    ...Type.body,
    flex: 1,
    minHeight: 42,
    maxHeight: 108,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  toolsContent: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 112,
  },
  toolTabs: { gap: Spacing.sm },
  toolTab: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
  },
  toolCard: {
    gap: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  toolHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  toolIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
  },
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
  result: {
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  resultList: { gap: Spacing.sm },
  listItem: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  listText: { flex: 1 },
  bullet: { width: 6, height: 6, borderRadius: Radius.pill, marginTop: 9 },
  insight: { gap: Spacing.xs, borderLeftWidth: 3, paddingLeft: Spacing.md },
  caution: { ...Type.label },
  disclaimer: { ...Type.caption, fontStyle: "italic" },
  proposal: {
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  recipientPicker: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  recipientOption: {
    minHeight: 38,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
  },
});
