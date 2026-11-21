// import { useEffect, useRef, useState } from "react";
// import { Stack, useLocalSearchParams, useRouter } from "expo-router";
// import { apiDownloadWithAuth } from "../api/client";
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import {
//   ActivityIndicator,
//   Alert,
//   FlatList,
//   Image,
//   KeyboardAvoidingView,
//   Linking,
//   Modal,
//   Platform,
//   Pressable,
//   StyleSheet,
//   View,
// } from "react-native";
// import * as FileSystem from "expo-file-system/legacy";
// import * as IntentLauncher from "expo-intent-launcher";
// import * as Sharing from "expo-sharing";
// import { Ionicons } from "@expo/vector-icons";
// import * as ImagePicker from "expo-image-picker";
// import * as DocumentPicker from "expo-document-picker";
// import { File } from "expo-file-system";
// import {
//   AppText as Text,
//   AppTextInput as TextInput,
// } from "../components/InterTypography";
// import { SafeAreaView } from "react-native-safe-area-context";
// import {
//   getTaskChats,
//   sendTaskChatMessage,
//   type TaskChatMessage,
//   type TaskProject,
//   updateTaskStatus,
//   uploadTaskChatAttachment,
// } from "../api/tasks";
// import { useAuth } from "../auth/AuthProvider";
// import { useTheme } from "../theme/ThemeProvider";

// function parseTask(value?: string): TaskProject | null {
//   try {
//     const parsed = JSON.parse(value || "");
//     return parsed && typeof parsed === "object" && "id" in parsed
//       ? (parsed as TaskProject)
//       : null;
//   } catch {
//     return null;
//   }
// }

// type NextTaskStatus = "Open" | "Work in Progress" | "Completed" | "Reopen";

// type PendingTaskAttachment = {
//   uri: string;
//   name: string;
//   mimeType?: string;
//   size?: number;
//   isImage: boolean;
//   uploadedUrl?: string;
// };

// function getTaskAttachmentUrl(path: string) {
//   const value = path.trim();

//   if (!value) return "";

//   if (/^https?:\/\//i.test(value)) return value;

//   const base = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

//   if (!base) return "";

//   const normalizedPath = value.replace(/^\/?backend(?=\/)/, "");
//   const filePath = normalizedPath.startsWith("/")
//     ? normalizedPath
//     : `/${normalizedPath}`;

//   return `${base}${filePath}`;
// }

// function isTaskImage(path: string) {
//   return /\.(jpe?g|png|gif|webp|heic|heif)(?:[?#]|$)/i.test(path);
// }

// function getTaskAttachmentMimeType(
//   fileName: string,
//   responseMimeType?: string | null,
// ): string {
//   const extension =
//     fileName.split(/[?#]/)[0]?.split(".").pop()?.toLowerCase() ?? "";

//   const mimeTypes: Record<string, string> = {
//     pdf: "application/pdf",
//     jpg: "image/jpeg",
//     jpeg: "image/jpeg",
//     png: "image/png",
//     gif: "image/gif",
//     webp: "image/webp",
//     doc: "application/msword",
//     docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//     xls: "application/vnd.ms-excel",
//     xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//     ppt: "application/vnd.ms-powerpoint",
//     pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
//     txt: "text/plain",
//     csv: "text/csv",
//     zip: "application/zip",
//   };

//   return mimeTypes[extension] ?? responseMimeType ?? "*/*";
// }

// function formatAttachmentSize(size?: number) {
//   if (!size) return "Ready to upload";
//   return size < 1024 * 1024
//     ? `${Math.ceil(size / 1024)} KB`
//     : `${(size / (1024 * 1024)).toFixed(1)} MB`;
// }

// function getNextTaskStatus(
//   currentStatus?: string | null,
// ): NextTaskStatus | null {
//   const normalized = currentStatus?.trim().toLowerCase() || "open";

//   const nextStatuses: Record<string, NextTaskStatus> = {
//     open: "Work in Progress",

//     wip: "Completed",
//     "work in progress": "Completed",
//     "in progress": "Completed",

//     completed: "Reopen",
//     closed: "Reopen",

//     reopen: "Open",
//     reopened: "Open",
//     "re-opened": "Open",

//     // Support existing tasks with legacy statuses.
//     scheduled: "Work in Progress",
//     rescheduled: "Work in Progress",
//     "on-hold": "Work in Progress",
//     "on hold": "Work in Progress",
//   };

//   return nextStatuses[normalized] ?? null;
// }

// function getTaskStatusLabel(status?: string | null) {
//   const normalized = status?.trim().toLowerCase() ?? "";

//   const labels: Record<string, string> = {
//     open: "Open",
//     completed: "Completed",
//     closed: "Completed",
//     wip: "Work In Progress",
//     "work in progress": "Work In Progress",
//     "in progress": "Work In Progress",
//     in_progress: "Work In Progress",
//     inprogress: "Work In Progress",
//     scheduled: "Scheduled",
//     rescheduled: "Rescheduled",
//     "on-hold": "On-Hold",
//     "on hold": "On-Hold",
//     on_hold: "On-Hold",
//     onhold: "On-Hold",
//     reopen: "Reopened",
//     reopened: "Reopened",
//     "re-opened": "Reopened",
//   };

//   return labels[normalized] || status?.trim() || "Open";
// }

// function getTaskStatusVisual(
//   status: string,
//   colors: {
//     primary: string;
//     primaryLight: string;
//     success?: string;
//     successBackground?: string;
//     warning?: string;
//     warningBackground?: string;
//     danger?: string;
//     dangerBackground?: string;
//     surfaceSecondary: string;
//     textSecondary: string;
//   },
// ) {
//   const normalized = status.trim().toLowerCase();

//   const statusStyles: Record<string, { color: string; background: string }> = {
//     completed: {
//       color: colors.success ?? colors.primary,
//       background: colors.successBackground ?? colors.primaryLight,
//     },
//     open: {
//       color: colors.primary,
//       background: colors.primaryLight,
//     },
//     "work in progress": {
//       color: colors.warning ?? colors.primary,
//       background: colors.warningBackground ?? colors.primaryLight,
//     },
//     scheduled: {
//       color: colors.primary,
//       background: colors.primaryLight,
//     },
//     rescheduled: {
//       color: colors.warning ?? colors.primary,
//       background: colors.warningBackground ?? colors.primaryLight,
//     },
//     "on-hold": {
//       color: colors.warning ?? colors.primary,
//       background: colors.warningBackground ?? colors.primaryLight,
//     },
//     reopened: {
//       color: colors.danger ?? colors.primary,
//       background: colors.dangerBackground ?? colors.primaryLight,
//     },
//   };

//   return (
//     statusStyles[normalized] ?? {
//       color: colors.textSecondary,
//       background: colors.surfaceSecondary,
//     }
//   );
// }

// export default function TaskChatScreen() {
//   const router = useRouter();
//   const { colors } = useTheme();
//   const { user, accessToken } = useAuth();
//   const employeeId = user?.employee?.id ?? user?.id ?? null;
//   const params = useLocalSearchParams<{ task?: string }>();
//   const rawTask = Array.isArray(params.task) ? params.task[0] : params.task;
//   const task = parseTask(rawTask);
//   const styles = createStyles(colors);

//   const [draft, setDraft] = useState("");
//   const [isPullRefreshing, setIsPullRefreshing] = useState(false);
//   const [currentStatus, setCurrentStatus] = useState(task?.status ?? "Open");
//   const statusVisual = getTaskStatusVisual(
//     getTaskStatusLabel(currentStatus),
//     colors,
//   );
//   const [statusPickerVisible, setStatusPickerVisible] = useState(false);
//   const [attachmentPickerVisible, setAttachmentPickerVisible] = useState(false);
//   const [pendingAttachment, setPendingAttachment] =
//     useState<PendingTaskAttachment | null>(null);

//   const canUpdateTaskStatus = Boolean(
//     task?.createdByEmployeeID != null &&
//     user?.employee?.id != null &&
//     Number(task.createdByEmployeeID) === Number(user.employee.id),
//   );

//   const queryClient = useQueryClient();
//   const listRef = useRef<FlatList<TaskChatMessage>>(null);

//   const chatsQuery = useQuery({
//     queryKey: ["task-chats", task?.id, employeeId],
//     queryFn: () => {
//       if (!task || !user || !accessToken) {
//         throw new Error("Unable to load task chat.");
//       }
//       return getTaskChats(task.id, user, accessToken);
//     },
//     enabled: Boolean(task && user && accessToken && employeeId),
//     refetchInterval: 15_000,
//     refetchIntervalInBackground: false,
//   });

//   const sendMutation = useMutation({
//     mutationFn: async () => {
//       if (
//         !task ||
//         !user ||
//         !accessToken ||
//         (!draft.trim() && !pendingAttachment)
//       ) {
//         throw new Error("Enter a message or choose an attachment.");
//       }

//       let attachmentUrl: string | undefined;

//       if (pendingAttachment) {
//         attachmentUrl =
//           pendingAttachment.uploadedUrl ??
//           (await uploadTaskChatAttachment(
//             {
//               uri: pendingAttachment.uri,
//               name: pendingAttachment.name,
//               mimeType: pendingAttachment.mimeType,
//             },
//             accessToken,
//           ));

//         if (!pendingAttachment.uploadedUrl) {
//           setPendingAttachment({
//             ...pendingAttachment,
//             uploadedUrl: attachmentUrl,
//           });
//         }
//       }

//       const message = draft.trim();
//       return sendTaskChatMessage(
//         task.id,
//         user,
//         accessToken,
//         message,
//         attachmentUrl,
//       );
//     },
//     onSuccess: async () => {
//       setDraft("");
//       setPendingAttachment(null);

//       await queryClient.invalidateQueries({
//         queryKey: ["task-chats", task?.id],
//       });
//     },
//   });

//   const statusMutation = useMutation({
//     mutationFn: (status: NextTaskStatus) => {
//       if (!task || !user || !accessToken) {
//         throw new Error("Unable to update task status.");
//       }

//       return updateTaskStatus(task.id, user, accessToken, status);
//     },
//     onSuccess: async (_updated, status) => {
//       setCurrentStatus(status);
//       setStatusPickerVisible(false);

//       await Promise.all([
//         queryClient.invalidateQueries({
//           queryKey: ["task-chats", task?.id],
//         }),
//         queryClient.invalidateQueries({
//           queryKey: ["tasks", "list"],
//         }),
//       ]);
//     },
//   });

//   const messages = chatsQuery.data ?? [];

//   const handlePullToRefresh = async () => {
//     setIsPullRefreshing(true);
//     try {
//       await chatsQuery.refetch();
//     } finally {
//       setIsPullRefreshing(false);
//     }
//   };

//   useEffect(() => {
//     listRef.current?.scrollToEnd({ animated: true });
//   }, [messages.length]);

//   const selectAttachment = (attachment: PendingTaskAttachment) => {
//     if ((attachment.size ?? 0) > 10 * 1024 * 1024) {
//       Alert.alert("File too large", "Choose a file smaller than 10 MB.");
//       return;
//     }

//     setPendingAttachment(attachment);
//   };

//   const pickCamera = async () => {
//     setAttachmentPickerVisible(false);

//     try {
//       const permission = await ImagePicker.requestCameraPermissionsAsync();

//       if (!permission.granted) {
//         Alert.alert(
//           "Camera permission required",
//           "Allow camera access to take task photos.",
//         );
//         return;
//       }

//       const result = await ImagePicker.launchCameraAsync({
//         mediaTypes: ["images"],
//         quality: 0.8,
//       });

//       if (!result.canceled && result.assets[0]) {
//         const asset = result.assets[0];

//         selectAttachment({
//           uri: asset.uri,
//           name: asset.fileName || "Camera-photo.jpg",
//           mimeType: asset.mimeType ?? "image/jpeg",
//           size: asset.fileSize,
//           isImage: true,
//         });
//       }
//     } catch {
//       Alert.alert("Camera error", "Unable to open the camera.");
//     }
//   };

//   const pickGallery = async () => {
//     setAttachmentPickerVisible(false);

//     try {
//       const result = await ImagePicker.launchImageLibraryAsync({
//         mediaTypes: ["images"],
//         quality: 0.8,
//       });

//       if (!result.canceled && result.assets[0]) {
//         const asset = result.assets[0];

//         selectAttachment({
//           uri: asset.uri,
//           name: asset.fileName || "Gallery-photo.jpg",
//           mimeType: asset.mimeType ?? "image/jpeg",
//           size: asset.fileSize,
//           isImage: true,
//         });
//       }
//     } catch {
//       Alert.alert("Gallery error", "Unable to select an image.");
//     }
//   };

//   const pickDocument = async () => {
//     setAttachmentPickerVisible(false);

//     try {
//       // Use Expo's native picker on Android and iOS.
//       if (Platform.OS !== "web") {
//         const result = await File.pickFileAsync({
//           mimeTypes: "*/*",
//         });

//         if (!result.canceled) {
//           const file = result.result;

//           console.log("NATIVE FILE PICKER:", {
//             uri: file.uri,
//             name: file.name,
//             mimeType: file.type,
//             size: file.size,
//             exists: file.exists,
//           });

//           selectAttachment({
//             uri: file.uri,
//             name: file.name,
//             mimeType: file.type || undefined,
//             size: file.size || undefined,
//             isImage: file.type.startsWith("image/") || isTaskImage(file.name),
//           });
//         }

//         return;
//       }

//       // Keep DocumentPicker for web.
//       const result = await DocumentPicker.getDocumentAsync({
//         type: "*/*",
//         copyToCacheDirectory: true,
//         multiple: false,
//       });

//       if (!result.canceled && result.assets[0]) {
//         const asset = result.assets[0];

//         selectAttachment({
//           uri: asset.uri,
//           name: asset.name,
//           mimeType: asset.mimeType,
//           size: asset.size,
//           isImage:
//             asset.mimeType?.startsWith("image/") || isTaskImage(asset.name),
//         });
//       }
//     } catch (error) {
//       console.log("FILE PICKER ERROR:", error);
//       Alert.alert("File error", "Unable to select this file.");
//     }
//   };

//   const openTaskAttachment = async (path: string) => {
//     try {
//       const url = getTaskAttachmentUrl(path);

//       if (!url) {
//         throw new Error("Attachment URL is unavailable.");
//       }

//       if (Platform.OS === "web") {
//         await Linking.openURL(url);
//         return;
//       }

//       let fileName = path.split(/[?#]/)[0]?.split("/").pop() || "attachment";

//       try {
//         fileName = decodeURIComponent(fileName);
//       } catch {}

//       const safeName =
//         fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_") || "attachment";

//       const cacheDirectory = FileSystem.cacheDirectory;

//       if (!cacheDirectory) {
//         throw new Error("Temporary file storage is unavailable.");
//       }

//       const destination = `${cacheDirectory}${Date.now()}-${safeName}`;

//       const download = await apiDownloadWithAuth(
//         url,
//         destination,
//         accessToken ?? null,
//       );

//       if (download.status < 200 || download.status >= 300) {
//         throw new Error(`Download failed: HTTP ${download.status}`);
//       }

//       const mimeType = getTaskAttachmentMimeType(safeName, download.mimeType);

//       if (Platform.OS === "android") {
//         const contentUri = await FileSystem.getContentUriAsync(download.uri);

//         await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
//           data: contentUri,
//           type: mimeType,
//           flags: 1,
//         });

//         return;
//       }

//       if (!(await Sharing.isAvailableAsync())) {
//         throw new Error("File sharing is not available on this device.");
//       }

//       await Sharing.shareAsync(download.uri, {
//         mimeType,
//         dialogTitle: `Open ${safeName}`,
//       });
//     } catch (error) {
//       Alert.alert(
//         "Unable to open attachment",
//         error instanceof Error ? error.message : "Please try again.",
//       );
//     }
//   };
//   const handleBack = () => {
//     if (router.canGoBack()) router.back();
//     else router.replace("/tasks");
//   };

//   return (
//     <>
//       <Stack.Screen
//         options={{
//           headerShown: false,
//           contentStyle: {
//             backgroundColor: colors.background,
//           },
//         }}
//       />
//       <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
//         <View style={styles.header}>
//           <Pressable onPress={handleBack} style={styles.backButton}>
//             <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
//           </Pressable>

//           <View style={{ flex: 1, minWidth: 0 }}>
//             <Text style={styles.title}>Task Chat</Text>
//             <Text style={styles.subtitle} numberOfLines={1}>
//               {task?.taskCode || "Task conversation"} · {task?.taskName || ""}
//             </Text>
//           </View>

//           {canUpdateTaskStatus ? (
//             <Pressable
//               onPress={() => {
//                 statusMutation.reset();
//                 setStatusPickerVisible(true);
//               }}
//               style={[
//                 styles.headerStatusButton,
//                 { backgroundColor: statusVisual.background },
//               ]}
//               disabled={statusMutation.isPending}
//               accessibilityRole="button"
//               accessibilityLabel={`Update task status. Current status ${getTaskStatusLabel(currentStatus)}`}
//             >
//               <View
//                 style={[
//                   styles.headerStatusDot,
//                   { backgroundColor: statusVisual.color },
//                 ]}
//               />

//               <Text
//                 style={[styles.headerStatusText, { color: statusVisual.color }]}
//                 numberOfLines={1}
//               >
//                 {getTaskStatusLabel(currentStatus)}
//               </Text>

//               <Ionicons
//                 name="chevron-down"
//                 size={14}
//                 color={statusVisual.color}
//               />
//             </Pressable>
//           ) : null}
//         </View>

//         {!task ? (
//           <View style={styles.empty}>
//             <Text>Task information unavailable.</Text>
//           </View>
//         ) : (
//           <KeyboardAvoidingView
//             style={{ flex: 1 }}
//             behavior={Platform.OS === "ios" ? "padding" : "height"}
//             keyboardVerticalOffset={0}
//           >
//             <FlatList
//               ref={listRef}
//               data={messages}
//               keyExtractor={(item) => String(item.id)}
//               contentContainerStyle={styles.messageList}
//               keyboardShouldPersistTaps="handled"
//               refreshing={isPullRefreshing}
//               onRefresh={() => void handlePullToRefresh()}
//               ListEmptyComponent={
//                 chatsQuery.isLoading ? (
//                   <ActivityIndicator color={colors.primary} />
//                 ) : (
//                   <Text style={styles.info}>
//                     {chatsQuery.isError
//                       ? "Unable to load messages. Pull down to retry."
//                       : "No messages yet. Start the conversation."}
//                   </Text>
//                 )
//               }
//               renderItem={({ item }) => {
//                 const isMine =
//                   (item.employeeID != null &&
//                     item.employeeID === user?.employee?.id) ||
//                   (item.userID != null && item.userID === user?.id);

//                 return (
//                   <View
//                     style={[styles.messageRow, isMine && styles.myMessageRow]}
//                   >
//                     <View
//                       style={[
//                         styles.bubble,
//                         isMine ? styles.myBubble : styles.otherBubble,
//                       ]}
//                     >
//                       <Text style={styles.sender}>
//                         {item.senderName || "Task participant"}
//                       </Text>
//                       {item.message &&
//                       !(
//                         item.attachmentUrl &&
//                         /^(?:📷\s*Photo|📎\s*.+)$/u.test(item.message.trim())
//                       ) ? (
//                         <Text style={styles.message}>{item.message}</Text>
//                       ) : null}
//                       {item.attachmentUrl ? (
//                         <Pressable
//                           onPress={() =>
//                             void openTaskAttachment(item.attachmentUrl!)
//                           }
//                           style={styles.messageAttachment}
//                         >
//                           {isTaskImage(item.attachmentUrl) ? (
//                             <Image
//                               source={{
//                                 uri: getTaskAttachmentUrl(item.attachmentUrl),
//                               }}
//                               style={styles.messageAttachmentImage}
//                               resizeMode="cover"
//                             />
//                           ) : (
//                             <View style={styles.messageFileRow}>
//                               <Ionicons
//                                 name="document-text-outline"
//                                 size={30}
//                                 color={colors.primary}
//                               />
//                               <View style={{ flex: 1 }}>
//                                 <Text
//                                   style={styles.fileAttachmentTitle}
//                                   numberOfLines={1}
//                                 >
//                                   {item.attachmentUrl
//                                     .split("/")
//                                     .pop()
//                                     ?.split("?")[0] || "Attachment"}
//                                 </Text>
//                               </View>
//                               <Ionicons
//                                 name="open-outline"
//                                 color={colors.primary}
//                                 size={18}
//                               />
//                             </View>
//                           )}
//                         </Pressable>
//                       ) : null}
//                       <Text style={styles.time}>
//                         {" "}
//                         {new Date(item.createdAt).toLocaleString(undefined, {
//                           day: "numeric",
//                           month: "short",
//                           hour: "2-digit",
//                           minute: "2-digit",
//                         })}
//                       </Text>
//                     </View>
//                   </View>
//                 );
//               }}
//             />

//             {chatsQuery.isError && messages.length > 0 && (
//               <Text style={styles.info}>Unable to refresh messages.</Text>
//             )}

//             {sendMutation.isError && (
//               <Text style={styles.info}>
//                 {sendMutation.error instanceof Error
//                   ? sendMutation.error.message
//                   : "Message could not be sent."}
//               </Text>
//             )}

//             {pendingAttachment ? (
//               <View style={styles.pendingAttachment}>
//                 {pendingAttachment.isImage ? (
//                   <Image
//                     source={{ uri: pendingAttachment.uri }}
//                     style={styles.pendingImage}
//                   />
//                 ) : (
//                   <Ionicons
//                     name="document-text-outline"
//                     size={30}
//                     color={colors.primary}
//                   />
//                 )}

//                 <View style={{ flex: 1, minWidth: 0 }}>
//                   <Text numberOfLines={1} style={styles.fileAttachmentTitle}>
//                     {pendingAttachment.name}
//                   </Text>
//                   <Text style={styles.fileAttachmentHint}>
//                     {pendingAttachment.uploadedUrl
//                       ? "Uploaded · Ready to send"
//                       : formatAttachmentSize(pendingAttachment.size)}
//                   </Text>
//                 </View>

//                 <Pressable
//                   onPress={() => setPendingAttachment(null)}
//                   hitSlop={10}
//                 >
//                   <Ionicons
//                     name="close-circle"
//                     size={22}
//                     color={colors.textSecondary}
//                   />
//                 </Pressable>
//               </View>
//             ) : null}

//             <View style={styles.composer}>
//               <Pressable
//                 onPress={() => setAttachmentPickerVisible(true)}
//                 disabled={sendMutation.isPending}
//                 style={styles.attachButton}
//                 accessibilityLabel="Add attachment"
//                 accessibilityRole="button"
//               >
//                 <Ionicons name="attach" size={23} color={colors.primary} />
//               </Pressable>

//               <TextInput
//                 value={draft}
//                 onChangeText={setDraft}
//                 placeholder="Write a message..."
//                 placeholderTextColor={colors.textMuted}
//                 style={styles.input}
//                 multiline
//                 maxLength={2000}
//               />

//               <Pressable
//                 onPress={() => sendMutation.mutate()}
//                 disabled={
//                   (!draft.trim() && !pendingAttachment) ||
//                   sendMutation.isPending
//                 }
//                 style={[
//                   styles.sendButton,
//                   ((!draft.trim() && !pendingAttachment) ||
//                     sendMutation.isPending) &&
//                     styles.disabled,
//                 ]}
//               >
//                 {sendMutation.isPending ? (
//                   <ActivityIndicator color={colors.white} size="small" />
//                 ) : (
//                   <Ionicons name="send" size={18} color={colors.white} />
//                 )}
//               </Pressable>
//             </View>
//           </KeyboardAvoidingView>
//         )}

//         <Modal
//           visible={attachmentPickerVisible}
//           transparent
//           animationType="slide"
//           onRequestClose={() => setAttachmentPickerVisible(false)}
//         >
//           <View style={styles.attachmentModalOverlay}>
//             <Pressable
//               style={styles.attachmentModalBackdrop}
//               onPress={() => setAttachmentPickerVisible(false)}
//             />

//             <View style={styles.attachmentModalCard}>
//               <View style={styles.attachmentModalHeader}>
//                 <Text style={styles.statusModalTitle}>Add attachment</Text>

//                 <Pressable
//                   onPress={() => setAttachmentPickerVisible(false)}
//                   hitSlop={10}
//                 >
//                   <Ionicons name="close" size={23} color={colors.textPrimary} />
//                 </Pressable>
//               </View>

//               <View style={styles.attachmentOptions}>
//                 {[
//                   {
//                     label: "Camera",
//                     icon: "camera-outline",
//                     action: pickCamera,
//                   },
//                   {
//                     label: "Gallery",
//                     icon: "images-outline",
//                     action: pickGallery,
//                   },
//                   {
//                     label: "Files",
//                     icon: "folder-open-outline",
//                     action: pickDocument,
//                   },
//                 ].map((option) => (
//                   <Pressable
//                     key={option.label}
//                     style={styles.attachmentOption}
//                     onPress={() => void option.action()}
//                   >
//                     <View style={styles.attachmentOptionIcon}>
//                       <Ionicons
//                         name={option.icon as any}
//                         size={25}
//                         color={colors.primary}
//                       />
//                     </View>
//                     <Text style={styles.attachmentOptionText}>
//                       {option.label}
//                     </Text>
//                   </Pressable>
//                 ))}
//               </View>

//               <Text style={styles.attachmentHint}>
//                 Photos and documents up to 10 MB
//               </Text>
//             </View>
//           </View>
//         </Modal>

//         <Modal
//           visible={statusPickerVisible}
//           transparent
//           animationType="fade"
//           onRequestClose={() => setStatusPickerVisible(false)}
//         >
//           <View style={styles.statusModalOverlay}>
//             <Pressable
//               style={styles.statusModalBackdrop}
//               onPress={() => setStatusPickerVisible(false)}
//             />

//             <View style={styles.statusModalCard}>
//               <View style={styles.statusModalHeader}>
//                 <Text style={styles.statusModalTitle}>Update task status</Text>

//                 <Pressable
//                   onPress={() => setStatusPickerVisible(false)}
//                   hitSlop={10}
//                 >
//                   <Ionicons name="close" size={22} color={colors.textPrimary} />
//                 </Pressable>
//               </View>
//               {(() => {
//                 const nextStatus = getNextTaskStatus(currentStatus);

//                 return nextStatus ? (
//                   <Pressable
//                     disabled={statusMutation.isPending}
//                     onPress={() => statusMutation.mutate(nextStatus)}
//                     style={[
//                       styles.statusOption,
//                       styles.statusOptionSelected,
//                       statusMutation.isPending && styles.disabled,
//                     ]}
//                   >
//                     <Text style={styles.statusOptionTextSelected}>
//                       {getTaskStatusLabel(nextStatus)}
//                     </Text>

//                     <Ionicons
//                       name="arrow-forward-circle"
//                       size={21}
//                       color={colors.primary}
//                     />
//                   </Pressable>
//                 ) : (
//                   <Text style={styles.statusError}>
//                     No next status available.
//                   </Text>
//                 );
//               })()}
//               {statusMutation.isPending ? (
//                 <ActivityIndicator
//                   color={colors.primary}
//                   style={{ marginTop: 10 }}
//                 />
//               ) : null}

//               {statusMutation.isError ? (
//                 <Text style={styles.statusError}>
//                   {statusMutation.error instanceof Error
//                     ? statusMutation.error.message
//                     : "Unable to update task status."}
//                 </Text>
//               ) : null}
//             </View>
//           </View>
//         </Modal>
//       </SafeAreaView>
//     </>
//   );
// }

// function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
//   return StyleSheet.create({
//     safeArea: {
//       flex: 1,
//       backgroundColor: colors.background,
//     },
//     header: {
//       flexDirection: "row",
//       alignItems: "center",
//       gap: 13,
//       padding: 18,
//       borderBottomWidth: 1,
//       borderBottomColor: colors.border,
//       backgroundColor: colors.background,
//     },
//     headerStatusButton: {
//       maxWidth: 145,
//       minHeight: 40,
//       flexDirection: "row",
//       alignItems: "center",
//       justifyContent: "center",
//       gap: 6,
//       paddingHorizontal: 12,
//       borderRadius: 11,
//       backgroundColor: colors.primaryLight,
//     },
//     headerStatusText: {
//       flexShrink: 1,
//       fontSize: 11,
//       fontWeight: "800",
//       color: colors.primary,
//     },
//     headerStatusDot: {
//       width: 7,
//       height: 7,
//       borderRadius: 4,
//     },
//     backButton: {
//       width: 42,
//       height: 42,
//       alignItems: "center",
//       justifyContent: "center",
//       borderRadius: 13,
//       backgroundColor: colors.surfaceSecondary,
//     },
//     title: {
//       fontSize: 19,
//       fontWeight: "800",
//       color: colors.textPrimary,
//     },
//     subtitle: {
//       marginTop: 3,
//       fontSize: 11,
//       color: colors.textSecondary,
//     },
//     messageList: {
//       flexGrow: 1,
//       padding: 16,
//       gap: 12,
//     },
//     messageRow: {
//       flexDirection: "row",
//       justifyContent: "flex-start",
//     },
//     myMessageRow: {
//       justifyContent: "flex-end",
//     },
//     bubble: {
//       maxWidth: "85%",
//       padding: 12,
//       borderRadius: 15,
//       gap: 5,
//     },
//     myBubble: {
//       backgroundColor: colors.primaryLight,
//     },
//     otherBubble: {
//       backgroundColor: colors.surface,
//       borderWidth: 1,
//       borderColor: colors.border,
//     },
//     sender: {
//       fontSize: 11,
//       fontWeight: "800",
//       color: colors.primary,
//     },
//     message: {
//       fontSize: 13,
//       lineHeight: 20,
//       color: colors.textPrimary,
//     },
//     time: {
//       fontSize: 10,
//       color: colors.textMuted,
//       textAlign: "right",
//     },
//     info: {
//       padding: 12,
//       textAlign: "center",
//       fontSize: 12,
//       color: colors.textSecondary,
//     },
//     attachmentModalOverlay: {
//       flex: 1,
//       justifyContent: "flex-end",
//       backgroundColor: "rgba(0,0,0,0.45)",
//     },
//     attachmentModalBackdrop: {
//       ...StyleSheet.absoluteFill,
//     },
//     attachmentModalCard: {
//       padding: 20,
//       paddingBottom: 30,
//       borderTopLeftRadius: 24,
//       borderTopRightRadius: 24,
//       backgroundColor: colors.surface,
//     },
//     attachmentModalHeader: {
//       flexDirection: "row",
//       justifyContent: "space-between",
//       alignItems: "center",
//       marginBottom: 22,
//     },
//     attachmentOptions: {
//       flexDirection: "row",
//       justifyContent: "space-around",
//     },
//     attachmentOption: {
//       alignItems: "center",
//       gap: 9,
//       flex: 1,
//     },
//     attachmentOptionIcon: {
//       width: 58,
//       height: 58,
//       borderRadius: 18,
//       alignItems: "center",
//       justifyContent: "center",
//       backgroundColor: colors.primaryLight,
//     },
//     attachmentOptionText: {
//       fontSize: 12,
//       fontWeight: "700",
//       color: colors.textPrimary,
//     },
//     attachmentHint: {
//       marginTop: 20,
//       textAlign: "center",
//       fontSize: 11,
//       color: colors.textMuted,
//     },
//     pendingAttachment: {
//       flexDirection: "row",
//       alignItems: "center",
//       gap: 12,
//       marginHorizontal: 12,
//       marginBottom: 8,
//       padding: 10,
//       borderRadius: 13,
//       backgroundColor: colors.surfaceSecondary,
//     },
//     pendingImage: {
//       width: 46,
//       height: 46,
//       borderRadius: 9,
//     },
//     fileAttachmentTitle: {
//       fontSize: 12,
//       fontWeight: "800",
//       color: colors.textPrimary,
//     },
//     fileAttachmentHint: {
//       marginTop: 3,
//       fontSize: 10,
//       color: colors.textSecondary,
//     },
//     attachButton: {
//       width: 40,
//       height: 44,
//       alignItems: "center",
//       justifyContent: "center",
//     },
//     messageAttachment: {
//       marginTop: 5,
//     },
//     messageAttachmentImage: {
//       width: 220,
//       height: 160,
//       borderRadius: 11,
//     },
//     messageFileRow: {
//       flexDirection: "row",
//       alignItems: "center",
//       gap: 10,
//       padding: 10,
//       borderRadius: 11,
//       backgroundColor: colors.surfaceSecondary,
//     },
//     statusModalOverlay: {
//       flex: 1,
//       alignItems: "center",
//       justifyContent: "center",
//       paddingHorizontal: 24,
//       backgroundColor: "rgba(0,0,0,0.45)",
//     },
//     statusModalBackdrop: {
//       ...StyleSheet.absoluteFill,
//     },
//     statusModalCard: {
//       width: "100%",
//       maxWidth: 380,
//       padding: 18,
//       borderRadius: 18,
//       borderWidth: 1,
//       borderColor: colors.border,
//       backgroundColor: colors.surface,
//     },
//     statusModalHeader: {
//       flexDirection: "row",
//       alignItems: "center",
//       justifyContent: "space-between",
//       marginBottom: 13,
//     },
//     statusModalTitle: {
//       fontSize: 16,
//       fontWeight: "800",
//       color: colors.textPrimary,
//     },
//     statusOption: {
//       minHeight: 43,
//       flexDirection: "row",
//       alignItems: "center",
//       justifyContent: "space-between",
//       paddingHorizontal: 12,
//       marginBottom: 7,
//       borderRadius: 10,
//       borderWidth: 1,
//       borderColor: colors.border,
//       backgroundColor: colors.surface,
//     },
//     statusOptionSelected: {
//       borderColor: colors.primary,
//       backgroundColor: colors.primaryLight,
//     },
//     statusOptionText: {
//       fontSize: 13,
//       fontWeight: "700",
//       color: colors.textPrimary,
//     },
//     statusOptionTextSelected: {
//       color: colors.primary,
//     },
//     statusError: {
//       marginTop: 10,
//       fontSize: 12,
//       textAlign: "center",
//       color: colors.textSecondary,
//     },
//     composer: {
//       flexDirection: "row",
//       alignItems: "flex-end",
//       gap: 9,
//       padding: 14,
//       borderTopWidth: 1,
//       borderTopColor: colors.border,
//       backgroundColor: colors.surface,
//     },
//     input: {
//       flex: 1,
//       minHeight: 44,
//       maxHeight: 100,
//       borderRadius: 13,
//       paddingHorizontal: 13,
//       paddingVertical: 10,
//       backgroundColor: colors.surfaceSecondary,
//       color: colors.textPrimary,
//       fontSize: 13,
//     },
//     sendButton: {
//       width: 44,
//       height: 44,
//       alignItems: "center",
//       justifyContent: "center",
//       borderRadius: 13,
//       backgroundColor: colors.primary,
//     },
//     disabled: {
//       opacity: 0.45,
//     },
//     empty: {
//       flex: 1,
//       alignItems: "center",
//       justifyContent: "center",
//     },
//   });
// }

import FeatureUnavailableScreen from "../components/FeatureUnavailableScreen";

export default function TaskChatScreen() {
  return <FeatureUnavailableScreen feature="Task chat" />;
}
