import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppText as Text } from "./InterTypography";
import OverviewCard from "./OverviewCard";
import { useTheme } from "../theme/ThemeProvider";
import { useManagerScope } from "../hooks/useManagerScope";

export default function Overview() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { hasReportees } = useManagerScope();

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <OverviewCard
          title="Attendance"
          icon="time-outline"
          iconColor={colors.textSecondary}
          iconBackground={colors.surface}
          onPress={() => router.push("/attendance-history")}
        />
        <OverviewCard
          iconColor={colors.primary}
          iconBackground={colors.primaryLight}
          title="Loan"
          icon="wallet-outline"
          onPress={() => router.push("/(tabs)/loan")}
        />

        <OverviewCard
          title=" Holiday"
          iconColor={colors.warning}
          iconBackground={colors.warningBackground}
          icon="sunny-outline"
          onPress={() => router.push("/holidays")}
        />

        {hasReportees && (
          <OverviewCard
            title="Approvals"
            icon="checkmark-done-outline"
            iconColor={colors.primary}
            iconBackground={colors.primaryLight}
            onPress={() => router.push("/approvals")}
          />
        )}

        <OverviewCard
          title="Payout"
          icon="wallet-outline"
          iconColor={colors.primary}
          iconBackground={colors.primaryLight}
          onPress={() => router.push("/(tabs)/payout")}
        />
      </View>
    </View>
  );
}

function createStyles(colors: { textPrimary: string }) {
  return StyleSheet.create({
    container: {
      marginTop: 4,
    },

    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      columnGap: 6,
      rowGap: 10,
    },
  });
}
