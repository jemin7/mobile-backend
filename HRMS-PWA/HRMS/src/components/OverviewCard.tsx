import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "./InterTypography";

import { useTheme } from "../theme/ThemeProvider";

type OverviewCardProps = {
  title: string;
  iconBackground: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  onPress?: () => void;
};
export default function OverviewCard({
  title,
  icon,
  iconColor,
  iconBackground,
  onPress,
}: OverviewCardProps) {
  const { colors } = useTheme();

  const styles = createStyles(colors);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
    </Pressable>
  );
}

function createStyles(colors: { textPrimary: string }) {
  return StyleSheet.create({
    button: {
      flex: 1,
      minWidth: 0,
      minHeight: 82,
      paddingHorizontal: 1,
      paddingVertical: 6,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      width: "100%",
      flexShrink: 1,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
    },
    pressed: {
      opacity: 0.75,
      transform: [{ scale: 0.96 }],
    },
  });
}
