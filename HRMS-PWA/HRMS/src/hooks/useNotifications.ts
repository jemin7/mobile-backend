import { useQuery } from "@tanstack/react-query";

import {
  getNotificationFeed,
  getRecentActivity,
  type NotificationFeedScope,
  type TeamActivityScope,
} from "../api/notifications";
import { useAuth } from "../auth/AuthProvider";

export function useNotifications(scope?: NotificationFeedScope) {
  const { user, accessToken } = useAuth();

  return useQuery({
    queryKey: ["notifications", "feed", scope ?? "default", user?.id],
    queryFn: () => {
      if (!accessToken) {
        throw new Error("Please sign in to load notifications.");
      }

      return getNotificationFeed(accessToken, scope);
    },
    enabled: Boolean(user && accessToken),
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useRecentActivity(scope: TeamActivityScope) {
  const { user, accessToken } = useAuth();

  return useQuery({
    queryKey: ["notifications", "activity", scope, user?.id],
    queryFn: () => {
      if (!accessToken) {
        throw new Error("Please sign in to load recent activity.");
      }

      return getRecentActivity(accessToken, scope);
    },
    enabled: Boolean(user && accessToken),
    staleTime: 30 * 1000,
    retry: 1,
  });
}
