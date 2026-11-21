import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTask,
  getTasks,
  getTaskCustomers,
  getTaskCustomerSites,
  type CreateTaskPayload,
  type TaskCustomerOption,
  type TaskCustomerSiteOption,
} from "../api/tasks";
import { useAuth } from "../auth/AuthProvider";

type UseTasksOptions = {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  assignedToMe?: boolean;
};

export function useTasks(options: UseTasksOptions = {}) {
  const { user, accessToken } = useAuth();

  const search = options.search?.trim() ?? "";
  const status = options.status?.trim() ?? "";
  const page = options.page ?? 1;
  const limit = options.limit ?? 50;
  const assignedToMe = options.assignedToMe ?? true;

  return useQuery({
    queryKey: [
      "tasks",
      "list",
      user?.id,
      user?.employee?.id,
      search,
      status,
      page,
      limit,
      assignedToMe,
    ],
    queryFn: () => {
      if (!user || !accessToken) {
        throw new Error("Please sign in to load your tasks.");
      }

      return getTasks(
        {
          user,
          search,
          status: status || undefined,
          page,
          limit,
          assignedToMe,
        },
        accessToken,
      );
    },

    enabled: Boolean(user && accessToken),

    staleTime: 30 * 1000,

    retry: 1,
  });
}

export function useCreateTask() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaskPayload) => createTask(data, accessToken),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tasks", "list"],
      });
    },
  });
}

export function useTaskCustomers() {
  const { user, accessToken } = useAuth();

  return useQuery<TaskCustomerOption[]>({
    queryKey: ["task-customers", user?.id, user?.companyID],
    queryFn: () => {
      if (!user || !accessToken) throw new Error("Please sign in.");
      return getTaskCustomers(user, accessToken);
    },
    enabled: Boolean(user && accessToken),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useTaskCustomerSites(customerID: number | null) {
  const { user, accessToken } = useAuth();

  return useQuery<TaskCustomerSiteOption[]>({
    queryKey: ["task-customer-sites", customerID, user?.id],
    queryFn: () => {
      if (!user || !accessToken || !customerID) {
        throw new Error("Customer selection is required.");
      }
      return getTaskCustomerSites(customerID, user, accessToken);
    },
    enabled: Boolean(user && accessToken && customerID),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
