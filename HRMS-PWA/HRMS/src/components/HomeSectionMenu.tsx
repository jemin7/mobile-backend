import { useRef, useState } from "react";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  Platform,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText as Text } from "./InterTypography";
import { useTheme } from "../theme/ThemeProvider";

export type HomeSection = "dashboard" | "team" | "reportees";

type Props = {
  activeSection: HomeSection;
  onSelect: (section: HomeSection) => void;
};

const MENU_WIDTH = 276;
const MENU_HEIGHT = 216;

const OPTIONS = [
  {
    value: "dashboard",
    label: "My Dashboard",
    description: "Your personal overview",
    icon: "grid-outline" as const,
  },
  {
    value: "reportees",
    label: "My Reportees",
    description: "Your direct reportees",
    icon: "git-network-outline" as const,
  },
  {
    value: "team",
    label: "My Team",
    description: "Direct and indirect reportees",
    icon: "people-outline" as const,
  },
] as const;

export default function HomeSectionMenu({ activeSection, onSelect }: Props) {
  const [visible, setVisible] = useState(false);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const selectSection = (section: HomeSection) => {
    setVisible(false);
    onSelect(section);
  };

  const triggerRef = useRef<React.ElementRef<typeof View>>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [menuPosition, setMenuPosition] = useState({
    top: 12,
    right: 12,
  });

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPosition({
        top: Math.max(
          12,
          Math.min(
            y +
              height +
              (Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0) +
              8,
            windowHeight - MENU_HEIGHT - 12,
          ),
        ),
        right: Math.max(
          12,
          Math.min(windowWidth - (x + width), windowWidth - MENU_WIDTH - 12),
        ),
      });

      setVisible(true);
    });
  };

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        style={({ pressed }) => [
          styles.settingsButton,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Switch dashboard section"
      >
        <Ionicons
          name="swap-horizontal-outline"
          size={23}
          color={colors.textPrimary}
        />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setVisible(false)}
            accessibilityLabel="Close section menu"
          />

          <View style={[styles.menu, menuPosition]}>
            {OPTIONS.map((option) => {
              const selected = activeSection === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => selectSection(option.value)}
                  style={({ pressed }) => [
                    styles.menuOption,
                    selected && styles.selectedOption,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View
                    style={[styles.optionIcon, selected && styles.selectedIcon]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={20}
                      color={selected ? colors.primary : colors.textSecondary}
                    />
                  </View>

                  <View style={styles.optionContent}>
                    <Text
                      style={[
                        styles.optionTitle,
                        selected && styles.selectedText,
                      ]}
                    >
                      {option.label}
                    </Text>

                    <Text style={styles.optionDescription}>
                      {option.description}
                    </Text>
                  </View>

                  {selected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={21}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(colors: {
  surface: string;
  surfaceSecondary: string;
  border: string;
  primary: string;
  primaryLight: string;
  textPrimary: string;
  textSecondary: string;
}) {
  return StyleSheet.create({
    settingsButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    modalRoot: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.16)",
    },

    menu: {
      position: "absolute",
      width: MENU_WIDTH,
      padding: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
    },

    menuOption: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 14,
      gap: 12,
    },
    selectedOption: {
      backgroundColor: colors.primaryLight,
    },

    optionIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSecondary,
    },

    optionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },

    selectedText: {
      color: colors.primary,
    },

    optionDescription: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textSecondary,
    },

    selectedIcon: {
      backgroundColor: colors.surface,
    },

    optionContent: {
      flex: 1,
      minWidth: 0,
    },

    pressed: {
      opacity: 0.7,
    },
  });
}
