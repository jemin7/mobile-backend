import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText as Text } from "./InterTypography";
import { useTheme } from "../theme/ThemeProvider";

type Props = {
  feature: string;
};

export default function FeatureUnavailableScreen({ feature }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="construct-outline" size={30} color={colors.primary} />
        </View>

        <Text style={styles.title}>Currently unavailable</Text>

        <Text style={styles.message}>
          {feature} is not available in the mobile app yet.
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: {
  background: string;
  surfaceSecondary: string;
  border: string;
  primary: string;
  textPrimary: string;
  textSecondary: string;
  white: string;
}) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    iconContainer: {
      width: 68,
      height: 68,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 22,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
    },
    title: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },
    message: {
      marginTop: 9,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: "center",
    },
    backButton: {
      marginTop: 22,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    backButtonText: {
      color: colors.white,
      fontSize: 13,
      fontWeight: "700",
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
