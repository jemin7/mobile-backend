"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import {
  Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog"
import { FormDrawer } from "../components/ui/form-drawer"
import { Badge } from "../components/ui/badge"
import { Edit, Trash2, Check, X, Plus, Settings, PlusCircle, MinusCircle, AlertCircle, Loader2, Wallet } from "lucide-react"
import { PageHeader } from "../components/app/page-header";
import { hasModuleWriteAccess, isCompanyAdminLikeRole } from "@/lib/companyAccess";
import { FilterBar } from "../components/app/filter-bar"
import { EntityListShell } from "../components/app/entity-list-shell"
import type { DataTableColumn } from "../components/app/data-table"
import { EntityRowActions } from "../components/app/entity-row-actions"
import { useClientTable, sortRows } from "../hooks/use-client-table"
import { SearchSuggestInput } from "../components/SearchSuggestInput"
import { CompanyBranchField } from "../components/app/company-branch-field"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { toast } from "sonner"
import { messageFromUnknownError, readApiErrorMessage } from "../utils/api-error"
import { getSidebarContext } from "../utils/sidebarContext"
import { resolveScopedCompanyId } from "../utils/scopeContext"

// ============ Type Definitions ============
type AdvanceStatus = "Pending" | "Approved" | "Rejected" | "Paid" | "Disbursed" | "Partially Recovered" | "Fully Recovered"
type RequestType = "SALARY_ADVANCE" | "EMPLOYEE_LOAN"
type RepaymentType = "ONE_TIME" | "INSTALMENTS"

interface RecoveryRow {
  id?: number
  periodLabel?: string
  amount?: string
  status?: string
}

interface SalaryAdvance {
  id: string
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  manageEmployeeID?: number
  serviceProvider?: string
  companyName?: string
  branchName?: string
  employeeName?: string
  previousAdvancesDue: string
  advanceAmount: string
  reason: string
  requestType?: RequestType
  approvedAmount?: string
  repaymentType?: RepaymentType
  deductionStartPeriod?: string
  instalmentCount?: number
  disbursedAmount?: string
  recoveredAmount?: string
  outstandingBalance?: string
  repayments?: RecoveryRow[]
  status: AdvanceStatus
  createdAt: string
}

interface SelectedItem {
  display: string
  value: number
  item: any
}

interface RepaymentRow {
  id?: number
  month: string
  amount: string
}

interface Company {
  id: number
  companyName: string
  financialYearStart: string
}

interface SalaryCycle {
  id: number
  companyID: number
  monthStartDay: string
}

interface FinancialYearOption {
  value: string
  label: string
}

interface SalaryPeriodOption {
  value: string
  label: string
}

interface SalaryAdvanceFormData {
  serviceProvider: string
  companyName: string
  branchName: string
  employeeName: string
  previousAdvancesDue: string
  advanceAmount: string
  reason: string
  requestType: RequestType
  repaymentType: RepaymentType
  deductionStartPeriod: string
  instalmentCount: string
  status: AdvanceStatus
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  manageEmployeeID?: number
}

interface ManagerData {
  id: number
  username: string
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  companyName:string
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"

export function SalaryAdvanceManagement() {
  const [advances, setAdvances] = useState<SalaryAdvance[]>([])
  const table = useClientTable("employeeName")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAdvance, setEditingAdvance] = useState<SalaryAdvance | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [managerData, setManagerData] = useState<ManagerData | null>(null)
  
  const [formData, setFormData] = useState<SalaryAdvanceFormData>({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    employeeName: "",
    previousAdvancesDue: "0",
    advanceAmount: "",
    reason: "",
    requestType: "SALARY_ADVANCE",
    repaymentType: "ONE_TIME",
    deductionStartPeriod: "",
    instalmentCount: "3",
    status: "Pending",
    serviceProviderID: undefined,
    companyID: undefined,
    branchesID: undefined,
    manageEmployeeID: undefined,
  })

  // ============ Repayment Modal State ============
  const [isRepaymentOpen, setIsRepaymentOpen] = useState(false)
  const [repaymentAdvance, setRepaymentAdvance] = useState<SalaryAdvance | null>(null)
  const [approvedAmount, setApprovedAmount] = useState("")
  const [repaymentRows, setRepaymentRows] = useState<RepaymentRow[]>([])
  const [financialYears, setFinancialYears] = useState<FinancialYearOption[]>([])
  const [salaryPeriods, setSalaryPeriods] = useState<SalaryPeriodOption[]>([])
  const [selectedFinancialYear, setSelectedFinancialYear] = useState("")
  const [selectedSalaryPeriod, setSelectedSalaryPeriod] = useState("")
  const [employeePeriods, setEmployeePeriods] = useState<string[]>([])
  const [scheduleType, setScheduleType] = useState<RepaymentType>("ONE_TIME")
  const [scheduleStart, setScheduleStart] = useState("")
  const [scheduleCount, setScheduleCount] = useState("3")
  const [disburseTarget, setDisburseTarget] = useState<SalaryAdvance | null>(null)
  const [disbursedAmount, setDisbursedAmount] = useState("")
  const [disbursementDate, setDisbursementDate] = useState("")
  const [paymentReference, setPaymentReference] = useState("")
  const [historyAdvance, setHistoryAdvance] = useState<SalaryAdvance | null>(null)
  
  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || isCompanyAdminLikeRole(user?.role) || user?.role === "BRANCH_ADMIN"
  const isEmployee = !canManage

  const ctx = getSidebarContext();

  const resolvedServiceProviderID =
  user?.role === "SERVICE_PROVIDER"
    ? (managerData?.serviceProviderID ?? ctx?.serviceProviderID ?? user?.serviceProviderID)
    : formData.serviceProviderID;

const resolvedCompanyID =
  user?.role === "SERVICE_PROVIDER"
    ? (managerData?.companyID ?? ctx?.companyID ?? user?.companyID)
    : (isCompanyAdminLikeRole(user?.role) || user?.role === "BRANCH_ADMIN")
    ? (formData.companyID ?? ctx?.companyID ?? user?.companyID)
    : (
        formData.companyID ??
        resolveScopedCompanyId(user) ??
        ctx?.companyID ??
        user?.companyID
      );

const resolvedBranchID = formData.branchesID;


  // ============ Load Manager Data ============
  useEffect(() => {
    const loadManagerData = async () => {
      if (user?.role === "SERVICE_PROVIDER") {
        try {
          const usersData = await robustGet<any[]>(`${BACKEND_URL}/users`)
          const currentUser = usersData.find(u => u.username === user.username)
          if (currentUser) {
            setManagerData({
              id: currentUser.id,
              username: currentUser.username,
              serviceProviderID: currentUser.serviceProviderID,
              companyID: currentUser.companyID,
              branchesID: currentUser.branchesID,
              companyName: currentUser.companyName || ""
            })
            
            // Auto-populate form data for manager
            if (currentUser.companyID) {
              const companyData = await robustGet<Company>(`${BACKEND_URL}/company/${currentUser.companyID}`)
              setFormData(prev => ({
                ...prev,
                companyID: currentUser.companyID,
                companyName: companyData?.companyName || "",
                branchesID: currentUser.branchesID
              }))
            }
          }
        } catch (error) {
          console.error("Failed to load manager data:", error)
        }
      }
    }
    
    if (user) {
      loadManagerData()
    }
  }, [user])

  // ============ API helpers ============
  const robustGet = useCallback(async <T = any>(url: string): Promise<T> => {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
  }, [])

  const robustFetch = useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init)
    if (!res.ok) throw new Error(await readApiErrorMessage(res, `Request failed (${res.status})`))
    return res.json().catch(() => ({}))
  }, [])

  const fetchServiceProviders = useCallback(async (q: string) => {
    const data = await robustGet<any[]>(`${BACKEND_URL}/service-provider`)
    return data.filter(d => (d.companyName || "").toLowerCase().includes(q.toLowerCase()))
  }, [robustGet])

const fetchCompanies = useCallback(
  async (q: string) => {
    const data = await robustGet<any[]>(`${BACKEND_URL}/company`);
    const query = q.toLowerCase();

    return data.filter(
      (c) => (c.companyName || "").toLowerCase().includes(query)
    );
  },
  [robustGet, resolvedServiceProviderID]
);


 const fetchBranches = useCallback(
  async (q: string) => {
    if (!resolvedCompanyID) return [];

    const data = await robustGet<any[]>(`${BACKEND_URL}/branches`);
    const query = q.toLowerCase();
    const rows = Array.isArray(data) ? data : [];
    const seen = new Set<number>();

    return rows.filter((b) => {
      const id = Number(b.id);
      if (!Number.isFinite(id) || seen.has(id)) return false;
      if (Number(b.companyID) !== Number(resolvedCompanyID)) return false;
      if (user?.role === "BRANCH_ADMIN" && Number(b.id) !== Number(user?.branchesID)) return false;
      if (!(b.branchName || "").toLowerCase().includes(query)) return false;
      seen.add(id);
      return true;
    });
  },
  [robustGet, resolvedCompanyID, user?.role, user?.branchesID]
);


 const fetchEmployees = useCallback(
  async (q: string) => {
    if (!resolvedCompanyID) return [];

    const data = await robustGet<any[]>(`${BACKEND_URL}/manage-emp`);
    const query = q.toLowerCase();

    return data.filter((e) => {
      const name = `${e.employeeFirstName || ""} ${e.employeeLastName || ""}`
        .trim()
        .toLowerCase();
      const empId = (e.employeeID || "").toLowerCase();

      const matchesCompany = Number(e.companyID) === Number(resolvedCompanyID);
      const matchesBranch =
        !resolvedBranchID || Number(e.branchesID) === Number(resolvedBranchID);

      return (
        matchesCompany &&
        matchesBranch &&
        (name.includes(query) || empId.includes(query) || !query)
      );
    });
  },
  [robustGet, resolvedCompanyID, resolvedBranchID]
);

  // ============ Form Validation ============
  const validateForm = useCallback((): boolean => {
    const amount = parseFloat(formData.advanceAmount)
    return (
      formData.manageEmployeeID !== undefined &&
      formData.advanceAmount.trim() !== "" &&
      !isNaN(amount) &&
      amount > 0 &&
      formData.reason.trim() !== "" &&
      formData.deductionStartPeriod.trim() !== "" &&
      (formData.repaymentType !== "INSTALMENTS" || Number(formData.instalmentCount) >= 1)
    )
  }, [formData])

  // ============ Financial Year & Salary Period Logic ============
  const getFinancialYearOptions = useCallback((financialYearStart: string): FinancialYearOption[] => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    
    if (financialYearStart.includes('Jan')) {
      return [
        { value: `${currentYear}`, label: `${currentYear}` },
        { value: `${currentYear + 1}`, label: `${currentYear + 1}` }
      ]
    } else if (financialYearStart.includes('Apr')) {
      const options: FinancialYearOption[] = []
      
      if (currentMonth >= 4) {
        options.push({ 
          value: `${currentYear}-${currentYear + 1}`, 
          label: `${currentYear}-${currentYear + 1}` 
        })
        options.push({ 
          value: `${currentYear + 1}-${currentYear + 2}`, 
          label: `${currentYear + 1}-${currentYear + 2}` 
        })
      } else {
        options.push({ 
          value: `${currentYear - 1}-${currentYear}`, 
          label: `${currentYear - 1}-${currentYear}` 
        })
        options.push({ 
          value: `${currentYear}-${currentYear + 1}`, 
          label: `${currentYear}-${currentYear + 1}` 
        })
      }
      
      return options
    }
    
    return [
      { value: `${currentYear}`, label: `${currentYear}` },
      { value: `${currentYear + 1}`, label: `${currentYear + 1}` }
    ]
  }, [])

  const getSalaryPeriodOptions = useCallback((monthStartDay: string, financialYear: string): SalaryPeriodOption[] => {
    const monthStart = parseInt(monthStartDay) || 1
    const periods: SalaryPeriodOption[] = []
    
    if (monthStart === 1) {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]
      
      if (financialYear.includes('-')) {
        const [startYear, endYear] = financialYear.split('-').map(Number)
        
        for (let i = 0; i < 12; i++) {
          const monthIndex = (i + 3) % 12
          const year = monthIndex >= 3 ? startYear : endYear
          periods.push({
            value: `${months[monthIndex]}-${year}`,
            label: `${months[monthIndex]} ${year}`
          })
        }
      } else {
        const year = parseInt(financialYear)
        months.forEach(month => {
          periods.push({
            value: `${month}-${year}`,
            label: `${month} ${year}`
          })
        })
      }
    } else {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]
      
      if (financialYear.includes('-')) {
        const [startYear, endYear] = financialYear.split('-').map(Number)
        
        for (let i = 0; i < 12; i++) {
          const currentMonth = (i + 3) % 12
          const nextMonth = (currentMonth + 1) % 12
          const year = currentMonth >= 3 ? startYear : endYear
          const nextMonthYear = nextMonth >= 3 ? startYear : endYear
          
          periods.push({
            value: `${months[currentMonth]}-${year}`,
            label: `${monthStart} ${months[currentMonth]} to ${monthStart - 1} ${months[nextMonth]} ${nextMonthYear}`
          })
        }
      } else {
        const year = parseInt(financialYear)
        
        for (let i = 0; i < 12; i++) {
          const currentMonth = i
          const nextMonth = (i + 1) % 12
          const nextMonthYear = nextMonth === 0 ? year + 1 : year
          
          periods.push({
            value: `${months[currentMonth]}-${year}`,
            label: `${monthStart} ${months[currentMonth]} to ${monthStart - 1} ${months[nextMonth]} ${nextMonthYear}`
          })
        }
      }
    }
    
    return periods
  }, [])

  const loadCompanyAndSalaryCycleData = useCallback(async (companyID: number) => {
    try {
      const companyData = await robustGet<Company>(`${BACKEND_URL}/company/${companyID}`)
      const salaryCycles = await robustGet<SalaryCycle[]>(`${BACKEND_URL}/salary-cycle`)
      const companySalaryCycle = salaryCycles.find(sc => sc.companyID === companyID)
      
      if (companyData && companySalaryCycle) {
        const fyOptions = getFinancialYearOptions(companyData.financialYearStart)
        setFinancialYears(fyOptions)
        setSelectedFinancialYear(fyOptions[0]?.value || "")
        
        if (fyOptions[0]) {
          const spOptions = getSalaryPeriodOptions(companySalaryCycle.monthStartDay, fyOptions[0].value)
          setSalaryPeriods(spOptions)
          setSelectedSalaryPeriod(spOptions[0]?.value || "")
        }
      }
    } catch (error) {
      console.error("Error loading company and salary cycle data:", error)
    }
  }, [robustGet, getFinancialYearOptions, getSalaryPeriodOptions])



  // ============ Repayment Validation Helpers ============
  const getUsedSalaryPeriods = useCallback((): string[] => {
    return repaymentRows.map(row => row.month).filter(Boolean)
  }, [repaymentRows])

  const getAvailableSalaryPeriods = useCallback((): SalaryPeriodOption[] => {
    const usedPeriods = getUsedSalaryPeriods()
    return salaryPeriods.filter(period => !usedPeriods.includes(period.value))
  }, [salaryPeriods, getUsedSalaryPeriods])

  const getTotalRepaymentAmount = useCallback((): number => {
    return repaymentRows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0)
  }, [repaymentRows])

  const getRemainingAmount = useCallback((): number => {
    const approved = parseFloat(approvedAmount) || 0
    return approved - getTotalRepaymentAmount()
  }, [approvedAmount, getTotalRepaymentAmount])

  const hasDuplicateSalaryPeriods = useCallback((): boolean => {
    const periods = getUsedSalaryPeriods()
    return new Set(periods).size !== periods.length
  }, [getUsedSalaryPeriods])

  const isAmountExceeded = useCallback((): boolean => {
    return getRemainingAmount() < 0
  }, [getRemainingAmount])

  const canAddMoreRows = useCallback((): boolean => {
    return getAvailableSalaryPeriods().length > 0 && getRemainingAmount() > 0
  }, [getAvailableSalaryPeriods, getRemainingAmount])

  const isRepaymentFormValid = useCallback((): boolean => {
    return (
      !!approvedAmount &&
      parseFloat(approvedAmount) > 0 &&
      repaymentRows.length > 0 &&
      !hasDuplicateSalaryPeriods() &&
      !isAmountExceeded() &&
      repaymentRows.every(row => row.month && row.amount && parseFloat(row.amount) > 0)
    )
  }, [approvedAmount, repaymentRows, hasDuplicateSalaryPeriods, isAmountExceeded])

  // ============ Salary Advance CRUD ============
  useEffect(() => {
    if (user) {
      loadAdvances()
    }
  }, [user])

  const loadAdvances = useCallback(async () => {
    setLoading(true)
    try {
      const data = await robustGet<any[]>(`${BACKEND_URL}/salary-advance`)

      const mapped = data.map(a => ({
        id: String(a.id),
        serviceProviderID: a.serviceProviderID,
        companyID: a.companyID,
        branchesID: a.branchesID,
        manageEmployeeID: a.manageEmployeeID,
        serviceProvider: a.serviceProvider?.companyName || "",
        companyName: a.company?.companyName || "",
        branchName: a.branches?.branchName || "",
        employeeName: a.manageEmployee
          ? `${a.manageEmployee.employeeFirstName || ""} ${a.manageEmployee.employeeLastName || ""} (${a.manageEmployee.employeeID})`
          : "",
        previousAdvancesDue: a.previousAdvancesDue || "0",
        advanceAmount: a.advanceAmount || "",
        reason: a.reason || "",
        requestType: (a.requestType === "EMPLOYEE_LOAN" ? "EMPLOYEE_LOAN" : "SALARY_ADVANCE") as RequestType,
        approvedAmount: a.approvedAmount || "",
        repaymentType: (a.repaymentType === "INSTALMENTS" ? "INSTALMENTS" : "ONE_TIME") as RepaymentType,
        deductionStartPeriod: a.deductionStartPeriod || "",
        instalmentCount: a.instalmentCount || undefined,
        disbursedAmount: a.disbursedAmount || "",
        recoveredAmount: a.recoveredAmount || "",
        outstandingBalance: a.outstandingBalance || "",
        repayments: Array.isArray(a.salaryAdvanceRepayment)
          ? a.salaryAdvanceRepayment.map((row: any) => ({
              id: row.id,
              periodLabel: row.periodLabel || "",
              amount: row.amount || "",
              status: row.status || "Scheduled",
            }))
          : [],
        status: (a.status || "Pending") as AdvanceStatus,
        createdAt: a.createdAt
          ? new Date(a.createdAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      }))

      if (user?.role === "SUPERADMIN") {
        setAdvances(mapped)
        return
      }

      if (user?.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext()
        if (ctx?.companyID) {
          const filtered = mapped.filter(
            a => a.companyID === ctx.companyID
          )
          setAdvances(filtered)
          return
        }
        const usersData = await robustGet<any[]>(`${BACKEND_URL}/users`)
        const currentUser = usersData.find(u => u.username === user.username)
        if (currentUser?.serviceProviderID) {
          setAdvances(mapped.filter((a: any) => a.serviceProviderID === currentUser.serviceProviderID))
          return
        }
      }

      // COMPANY_ADMIN / BRANCH_ADMIN: filter by company
      if (isCompanyAdminLikeRole(user?.role) || user?.role === "BRANCH_ADMIN") {
        const ctx = getSidebarContext()
        const companyID = ctx?.companyID ?? user?.companyID
        if (companyID) {
          setAdvances(mapped.filter((a: any) => a.companyID === companyID))
        } else {
          setAdvances([])
        }
        return
      }

      const creds = await robustGet<any[]>(`${BACKEND_URL}/manage-emp/credentials/all`)
      const emp = creds.find(c => c.username === user?.username)
      if (emp) {
        const filtered = mapped.filter(
          a =>
            a.companyID === emp.companyID &&
            a.branchesID === emp.branchesID &&
            a.manageEmployeeID === emp.employeeID
        )
        setAdvances(filtered)
      } else {
        setAdvances([])
      }
    } catch (error) {
      console.error("Failed to load advances:", error)
      setAdvances([])
    } finally {
      setLoading(false)
    }
  }, [user, robustGet])

  const loadEmployeePeriods = useCallback(async (employeeId?: number) => {
    if (!employeeId) {
      setEmployeePeriods([])
      return []
    }
    try {
      const data = await robustGet<{ periods?: string[] }>(`${BACKEND_URL}/salary-cycle/employee/${employeeId}/periods`)
      const periods = Array.isArray(data?.periods) ? data.periods : []
      setEmployeePeriods(periods)
      return periods
    } catch {
      setEmployeePeriods([])
      return []
    }
  }, [robustGet])

  const handleEmployeeSelect = useCallback(async (selected: SelectedItem) => {
    const emp = selected.item
    setFormData((p) => ({
      ...p,
     employeeName: `${emp.employeeFirstName || ""} ${emp.employeeLastName || ""} (${emp.employeeID})`,
    manageEmployeeID: emp.id,
    deductionStartPeriod: "",
    }))
    void loadEmployeePeriods(emp.id)
    try {
      const data = await robustGet<any[]>(`${BACKEND_URL}/salary-advance`)
      const dues = data.filter((a) => a.manageEmployeeID === selected.value && a.status !== "Paid")
      const total = dues.reduce((sum, cur) => sum + (parseFloat(cur.advanceAmount || "0")), 0)
      setFormData((p) => ({ ...p, previousAdvancesDue: String(total) }))
    } catch {
      setFormData((p) => ({ ...p, previousAdvancesDue: "0" }))
    }
  }, [robustGet, loadEmployeePeriods])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error("Please fill all required fields with valid data")
      return
    }

    setSubmitting(true)
    try {
      // For managers, auto-populate their company and branch data
      const submitData = {
        serviceProviderID: user?.role === "SERVICE_PROVIDER" ? managerData?.serviceProviderID : formData.serviceProviderID,
        companyID: user?.role === "SERVICE_PROVIDER" ? managerData?.companyID : formData.companyID,
        branchesID: user?.role === "SERVICE_PROVIDER" ? managerData?.branchesID : formData.branchesID,
        manageEmployeeID: formData.manageEmployeeID,
        previousAdvancesDue: formData.previousAdvancesDue,
        advanceAmount: formData.advanceAmount,
        reason: formData.reason,
        requestType: formData.requestType,
        repaymentType: formData.repaymentType,
        deductionStartPeriod: formData.deductionStartPeriod,
        instalmentCount: formData.repaymentType === "INSTALMENTS" ? Number(formData.instalmentCount) : 1,
        status: formData.status,
      }
      
      const url = editingAdvance 
        ? `${BACKEND_URL}/salary-advance/${editingAdvance.id}` 
        : `${BACKEND_URL}/salary-advance`
        
      const method = editingAdvance ? "PATCH" : "POST"
      
      await robustFetch(url, { 
        method, 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(submitData) 
      })
      
      await loadAdvances()
      resetForm()
      setIsDialogOpen(false)
      toast.success("Salary advance saved successfully")
    } catch (error) {
      console.error("Failed to save advance:", error)
      toast.error(messageFromUnknownError(error, "Failed to save salary advance. Please try again."))
    } finally {
      setSubmitting(false)
    }
  }, [formData, editingAdvance, validateForm, robustFetch, loadAdvances, user?.role, managerData])

  const resetForm = useCallback(() => {
    const ctx = getSidebarContext();
    const scopedCompany =
      resolveScopedCompanyId(user) ??
      ctx?.companyID ??
      user?.companyID ??
      undefined;
    setFormData({
      serviceProvider: "", 
      companyName: user?.role === "SERVICE_PROVIDER" ? managerData?.companyName || "" : "", 
      branchName: "", 
      employeeName: "",
      previousAdvancesDue: "0", 
      advanceAmount: "", 
      reason: "",
      requestType: "SALARY_ADVANCE",
      repaymentType: "ONE_TIME",
      deductionStartPeriod: "",
      instalmentCount: "3",
      status: "Pending", 
      serviceProviderID: user?.role === "SERVICE_PROVIDER" ? managerData?.serviceProviderID : undefined,
      companyID: user?.role === "SERVICE_PROVIDER"
        ? managerData?.companyID
        : (isCompanyAdminLikeRole(user?.role) || user?.role === "BRANCH_ADMIN" || user?.role === "EMPLOYEE")
        ? scopedCompany
        : undefined,
      branchesID: user?.role === "SERVICE_PROVIDER" ? managerData?.branchesID : undefined,
      manageEmployeeID: undefined
    })
    setEditingAdvance(null)
  }, [user, managerData])

  const handleEdit = useCallback((a: SalaryAdvance) => {
    setFormData({
      serviceProvider: a.serviceProvider || "", 
      companyName: a.companyName || "", 
      branchName: a.branchName || "",
      employeeName: a.employeeName || "", 
      previousAdvancesDue: a.previousAdvancesDue || "0", 
      advanceAmount: a.advanceAmount || "",
      reason: a.reason || "",
      requestType: a.requestType || "SALARY_ADVANCE",
      repaymentType: a.repaymentType || "ONE_TIME",
      deductionStartPeriod: a.deductionStartPeriod || "",
      instalmentCount: String(a.instalmentCount || 3),
      status: a.status || "Pending",
      serviceProviderID: a.serviceProviderID, 
      companyID: a.companyID, 
      branchesID: a.branchesID, 
      manageEmployeeID: a.manageEmployeeID
    })
    setEditingAdvance(a)
    setIsDialogOpen(true)
    void loadEmployeePeriods(a.manageEmployeeID)
  }, [loadEmployeePeriods])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await robustFetch(`${BACKEND_URL}/salary-advance/${id}`, { method: "DELETE" })
      await loadAdvances()
      toast.success("Salary advance deleted successfully")
    } catch (error) {
      console.error("Failed to delete advance:", error)
      toast.error(messageFromUnknownError(error, "Failed to delete salary advance. Please try again."))
    }
  }, [robustFetch, loadAdvances])

  const handleApprove = useCallback((advance: SalaryAdvance) => {
    openRepaymentModal(advance)
  }, [])

  const handleReject = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to reject this salary advance?")) {
      return
    }

    try {
      await robustFetch(`${BACKEND_URL}/salary-advance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Rejected" })
      })
      await loadAdvances()
    } catch (error) {
      console.error("Failed to reject advance:", error)
      toast.error("Failed to reject salary advance. Please try again.")
    }
  }, [robustFetch, loadAdvances])

  const filteredAdvances = useMemo(() => {
    const t = table.search.trim().toLowerCase()
    let list = advances.filter((a) =>
      !t ||
      (a.companyName || "").toLowerCase().includes(t) ||
      (a.employeeName || "").toLowerCase().includes(t) ||
      (a.advanceAmount || "").toLowerCase().includes(t)
    )
    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const a = row as SalaryAdvance
      if (key === "employeeName") return a.employeeName ?? ""
      if (key === "previousAdvancesDue") return a.previousAdvancesDue ?? ""
      if (key === "advanceAmount") return a.advanceAmount ?? ""
      if (key === "reason") return a.reason ?? ""
      if (key === "status") return a.status ?? ""
      return ""
    })
  }, [advances, table.search, table.sortBy, table.sortDir])

  // ============ Repayment API ============
  const loadRepaymentsForAdvance = useCallback(async (advanceId: number) => {
    try {
      const rows = await robustGet<any[]>(`${BACKEND_URL}/salary-advance-repayment/advance/${advanceId}`)
      return rows
    } catch {
      return []
    }
  }, [robustGet])

  const clearRepaymentsForAdvance = useCallback(async (existing: Array<{ id: number }>) => {
    for (const r of existing) {
      await robustFetch(`${BACKEND_URL}/salary-advance-repayment/${r.id}`, { method: "DELETE" })
    }
  }, [robustFetch])

  const saveRepaymentPlan = useCallback(async (advanceId: number, approvedAmount: string, rows: RepaymentRow[]) => {
    const existing = await loadRepaymentsForAdvance(advanceId)
    if (existing && existing.length) {
      await clearRepaymentsForAdvance(existing)
    }

    for (const row of rows) {
      if (!row.month || !row.amount) continue
      
      const [monthName, year] = row.month.split('-')
      const monthIndex = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ].indexOf(monthName)
      
      if (monthIndex !== -1) {
        const startMonthISO = new Date(Date.UTC(parseInt(year), monthIndex, 1)).toISOString()
        
        await robustFetch(`${BACKEND_URL}/salary-advance-repayment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salaryAdvanceID: advanceId,
            approvedAmount: approvedAmount,
            startMonth: startMonthISO,
            amount: row.amount
          })
        })
      }
    }
  }, [loadRepaymentsForAdvance, clearRepaymentsForAdvance, robustFetch])

  // ============ Repayment Modal Handlers ============
  const openRepaymentModal = useCallback((a: SalaryAdvance) => {
    setRepaymentAdvance(a)
    setIsRepaymentOpen(true)
    setApprovedAmount(a.approvedAmount || a.advanceAmount || "")
    setScheduleType(a.repaymentType || "ONE_TIME")
    setScheduleStart(a.deductionStartPeriod || "")
    setScheduleCount(String(a.instalmentCount || 3))
    void loadEmployeePeriods(a.manageEmployeeID).then((periods) => {
      if (!a.deductionStartPeriod && periods[0]) setScheduleStart(periods[0])
    })
  }, [loadEmployeePeriods])

  const addRepaymentRow = useCallback(() => {
    if (!selectedSalaryPeriod) {
      toast.error("Please select a salary period first")
      return
    }
    
    if (getUsedSalaryPeriods().includes(selectedSalaryPeriod)) {
      toast.error("This salary period is already selected. Please choose a different one.")
      return
    }
    
    if (!canAddMoreRows()) {
      toast.error("Cannot add more repayment entries. Either all periods are used or approved amount is fully allocated.")
      return
    }
    
    setRepaymentRows(prev => [...prev, { month: selectedSalaryPeriod, amount: "" }])
  }, [selectedSalaryPeriod, getUsedSalaryPeriods, canAddMoreRows])

  const removeRepaymentRow = useCallback((idx: number) => {
    setRepaymentRows(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const updateRepaymentRow = useCallback((idx: number, key: "month" | "amount", value: string) => {
    setRepaymentRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r))
  }, [])

  const schedulePreview = useMemo(() => {
    const amount = parseFloat(approvedAmount) || 0
    const startAt = employeePeriods.indexOf(scheduleStart)
    if (startAt < 0 || amount <= 0) return []
    const count = scheduleType === "INSTALMENTS" ? Math.max(1, Number(scheduleCount) || 1) : 1
    const chosen = employeePeriods.slice(startAt, startAt + count)
    if (chosen.length === 0) return []
    const paise = Math.round(amount * 100)
    const base = Math.floor(paise / chosen.length)
    return chosen.map((period, index) => ({
      period,
      amount: ((index === chosen.length - 1 ? paise - base * (chosen.length - 1) : base) / 100).toFixed(2),
    }))
  }, [approvedAmount, employeePeriods, scheduleStart, scheduleType, scheduleCount])

  const saveRepayment = useCallback(async () => {
    if (!repaymentAdvance) return
    const amount = parseFloat(approvedAmount)
    if (!amount || amount <= 0 || !scheduleStart) {
      toast.error("Choose an approved amount and the deduction month.")
      return
    }
    const locked = ["Disbursed", "Partially Recovered", "Fully Recovered"].includes(repaymentAdvance.status)
    try {
      await robustFetch(`${BACKEND_URL}/salary-advance/${repaymentAdvance.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: approvedAmount,
          repaymentType: scheduleType,
          deductionStartPeriod: scheduleStart,
          instalmentCount: scheduleType === "INSTALMENTS" ? Number(scheduleCount) || 1 : 1,
          approve: !locked,
        }),
      })
      await loadAdvances()
      setIsRepaymentOpen(false)
      toast.success(locked ? "Repayment schedule updated" : "Request approved")
    } catch (error) {
      console.error("Error saving repayment plan:", error)
      toast.error(messageFromUnknownError(error, "Error saving repayment plan. Please try again."))
    }
  }, [repaymentAdvance, approvedAmount, scheduleStart, scheduleType, scheduleCount, robustFetch, loadAdvances])

  const saveDisbursement = useCallback(async () => {
    if (!disburseTarget) return
    if (!disbursedAmount || !disbursementDate) {
      toast.error("Enter the disbursed amount and date.")
      return
    }
    try {
      await robustFetch(`${BACKEND_URL}/salary-advance/${disburseTarget.id}/disburse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disbursedAmount,
          disbursementDate,
          paymentReference,
        }),
      })
      await loadAdvances()
      setDisburseTarget(null)
      toast.success("Disbursement recorded")
    } catch (error) {
      toast.error(messageFromUnknownError(error, "Could not record disbursement."))
    }
  }, [disburseTarget, disbursedAmount, disbursementDate, paymentReference, robustFetch, loadAdvances])

  const advanceColumns = useMemo((): DataTableColumn<SalaryAdvance>[] => [
    {
      key: "employeeName",
      header: "Employee",
      sortable: true,
      colSpan: 3,
      cell: (a) => <span className="font-medium">{a.employeeName || "—"}</span>,
    },
    {
      key: "previousAdvancesDue",
      header: "Prev Due",
      sortable: true,
      colSpan: 2,
      cell: (a) => a.previousAdvancesDue || "0",
    },
    {
      key: "requestType",
      header: "Type",
      sortable: true,
      colSpan: 2,
      cell: (a) => a.requestType === "EMPLOYEE_LOAN" ? "Employee Loan" : "Salary Advance",
    },
    {
      key: "advanceAmount",
      header: "Requested",
      sortable: true,
      colSpan: 2,
      cell: (a) => a.advanceAmount || "—",
    },
    {
      key: "outstandingBalance",
      header: "Outstanding",
      sortable: true,
      colSpan: 2,
      cell: (a) => a.outstandingBalance || a.approvedAmount || "—",
    },
    {
      key: "reason",
      header: "Reason",
      sortable: true,
      colSpan: 3,
      cell: (a) => a.reason || "—",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      colSpan: 2,
      cell: (a) => (
        <Badge
          className={
            a.status === "Approved" || a.status === "Disbursed" ? "bg-green-600 hover:bg-green-600" :
            a.status === "Fully Recovered" || a.status === "Paid" ? "bg-gray-900 hover:bg-gray-900" :
            a.status === "Partially Recovered" ? "bg-blue-600 hover:bg-blue-600" :
            a.status === "Rejected" ? "bg-red-600 hover:bg-red-600" :
            "bg-yellow-500 hover:bg-yellow-500"
          }
        >
          {a.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 3,
      align: "right",
      cell: (a) => {
        const extras: { icon: typeof Settings; title: string; onClick: () => void; className?: string }[] = []
        const settled = a.status === "Disbursed" || a.status === "Partially Recovered" || a.status === "Fully Recovered" || a.status === "Paid"
        if (canManage) {
          extras.push({
            icon: Settings,
            title: "Repayment schedule",
            onClick: () => openRepaymentModal(a),
          })
          extras.push({
            icon: Wallet,
            title: "Recovery history",
            onClick: () => setHistoryAdvance(a),
          })
          if (a.status === "Pending") {
            extras.push(
              { icon: Check, title: "Approve", onClick: () => handleApprove(a), className: "text-green-600" },
              { icon: X, title: "Reject", onClick: () => handleReject(a.id), className: "text-destructive" },
            )
          }
          if (a.status === "Approved") {
            extras.push({
              icon: PlusCircle,
              title: "Record disbursement",
              onClick: () => {
                setDisburseTarget(a)
                setDisbursedAmount(a.approvedAmount || a.advanceAmount || "")
                setDisbursementDate(new Date().toISOString().slice(0, 10))
                setPaymentReference("")
              },
              className: "text-green-700",
            })
          }
        }
        return (
          <EntityRowActions
            onEdit={
              (canManage || (isEmployee && a.status === "Pending")) && !settled
                ? () => handleEdit(a)
                : undefined
            }
            onDelete={
              (canManage || (isEmployee && a.status === "Pending")) && !settled && a.status !== "Approved"
                ? () => handleDelete(a.id)
                : undefined
            }
            extra={extras.length > 0 ? extras : undefined}
          />
        )
      },
    },
  ], [canManage, isEmployee, handleApprove, handleReject, openRepaymentModal, handleEdit, handleDelete])

  // ===================== UI =====================
  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={Wallet}
        title="Salary Advances"
        description="Track advances, approvals, and repayments for your organization"
        actions={
          !isDialogOpen ? (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />
              Add Salary Advance
            </Button>
          ) : null
        }
      />
      {/* FormDrawer for Add/Edit */}
      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={`${editingAdvance ? "Edit" : "Add"} Salary Advance`}
        description="Fill in the details for the salary advance."
      >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Org Selection - Hidden for Managers */}
              {user?.role === "SUPERADMIN" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  <SearchSuggestInput 
                    label="Company" 
                    placeholder="Select Company" 
                    value={formData.companyName} 
                    onChange={v => setFormData(p => ({ ...p, companyName: v }))} 
                    onSelect={s => setFormData(p => ({ ...p, companyName: s.display, companyID: s.value }))} 
                    fetchData={fetchCompanies} 
                    displayField="companyName" 
                    valueField="id"  
                  />
                  <CompanyBranchField 
                    label="Branch" 
                    placeholder="Select Branch" 
                    value={formData.branchName} 
                    onChange={v => setFormData(p => ({ ...p, branchName: v }))} 
                    onSelect={s => setFormData(p => ({ ...p, branchName: s.display, branchesID: s.value }))} 
                    fetchData={fetchBranches} 
                    displayField="branchName" 
                    valueField="id"
                    companyID={formData.companyID ?? resolvedCompanyID}
                  />
                </div>
              )}

              {/* For Managers - Show read-only company info */}
              {user?.role === "SERVICE_PROVIDER" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 
                  <CompanyBranchField 
                    label="Branch" 
                    placeholder="Select Branch" 
                    value={formData.branchName} 
                    onChange={v => setFormData(p => ({ ...p, branchName: v }))} 
                    onSelect={s => setFormData(p => ({ ...p, branchName: s.display, branchesID: s.value }))} 
                    fetchData={fetchBranches} 
                    displayField="branchName" 
                    valueField="id"
                    companyID={formData.companyID ?? resolvedCompanyID}
                  />
                </div>
              )}

              {/* For COMPANY_ADMIN / BRANCH_ADMIN - Show branch input */}
              {(isCompanyAdminLikeRole(user?.role) || user?.role === "BRANCH_ADMIN") && (
                <div className="grid grid-cols-1 gap-4">
                  <CompanyBranchField 
                    label="Branch" 
                    placeholder="Select Branch" 
                    value={formData.branchName} 
                    onChange={v => setFormData(p => ({ ...p, branchName: v }))} 
                    onSelect={s => setFormData(p => ({ ...p, branchName: s.display, branchesID: s.value }))} 
                    fetchData={fetchBranches} 
                    displayField="branchName" 
                    valueField="id"
                    companyID={formData.companyID ?? resolvedCompanyID}
                  />
                </div>
              )}

              {/* Employee */}
              <SearchSuggestInput
                label="Employee"
                placeholder="Select Employee"
                value={formData.employeeName}
                onChange={(v) => setFormData((p) => ({ ...p, employeeName: v }))}
                onSelect={async (selected) => {
                  const data = await fetchEmployees("")
                  const item = data.find((d: any) => d.id === selected.value) || selected.item
                  const formatted = `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""} (${item?.employeeID})`
                  await handleEmployeeSelect({ display: formatted, value: selected.value, item })
                }}
                fetchData={async (q: string) => {
                  const data = await fetchEmployees(q)
                  return data.map((emp: any) => ({
                    ...emp,
                    display: `${emp.employeeFirstName || ""} ${emp.employeeLastName || ""} (${emp.employeeID})`,
                    value: emp.id,
                  }))
                }}
                displayField="display"
                valueField="value"
                required
              />

              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Previous Advances Due</Label>
                  <Input 
                    type="text" 
                    value={formData.previousAdvancesDue} 
                    readOnly 
                    className="bg-gray-100" 
                  />
                </div>
                <div>
                  <Label>Advance Amount *</Label>
                  <Input 
                    type="text" 
                    value={formData.advanceAmount} 
                    onChange={e => setFormData(p => ({ ...p, advanceAmount: e.target.value }))} 
                    required 
                  />
                </div>
              </div>

              <div>
                <Label>Reason *</Label>
                <Input 
                  type="text" 
                  value={formData.reason} 
                  onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))} 
                  required 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Request Type *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.requestType}
                    onChange={(e) => setFormData((p) => ({ ...p, requestType: e.target.value as RequestType }))}
                  >
                    <option value="SALARY_ADVANCE">Salary Advance</option>
                    <option value="EMPLOYEE_LOAN">Employee Loan</option>
                  </select>
                </div>
                <div>
                  <Label>Repayment *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.repaymentType}
                    onChange={(e) => setFormData((p) => ({ ...p, repaymentType: e.target.value as RepaymentType }))}
                  >
                    <option value="ONE_TIME">One-time deduction</option>
                    <option value="INSTALMENTS">Monthly instalments</option>
                  </select>
                </div>
                <div>
                  <Label>Deduction starting month *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.deductionStartPeriod}
                    onChange={(e) => setFormData((p) => ({ ...p, deductionStartPeriod: e.target.value }))}
                    required
                  >
                    <option value="">{formData.manageEmployeeID ? "Select month" : "Select an employee first"}</option>
                    {employeePeriods.map((period) => (
                      <option key={period} value={period}>{period}</option>
                    ))}
                  </select>
                </div>
                {formData.repaymentType === "INSTALMENTS" && (
                  <div>
                    <Label>Number of instalments *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.instalmentCount}
                      onChange={(e) => setFormData((p) => ({ ...p, instalmentCount: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingAdvance ? "Update Salary Advance" : "Add Salary Advance"}
                </Button>
              </div>
            </form>
      </FormDrawer>

      {!isDialogOpen && (
      <>
      <FilterBar
        search={{
          value: table.search,
          onChange: table.setSearch,
          placeholder: "Search advances…",
        }}
      />

      <EntityListShell
        title="Salary advances"
        columns={advanceColumns}
        rows={filteredAdvances}
        rowKey={(a) => a.id}
        isLoading={loading}
        sortBy={table.sortBy}
        sortDir={table.sortDir}
        onSort={table.setSort}
        emptyIcon={Wallet}
        emptyTitle="No salary advances found"
        emptyDescription="Add a salary advance request to get started."
        emptyAction={
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />
            Add Salary Advance
          </Button>
        }
      />
      </>
      )}

      <Dialog open={isRepaymentOpen} onOpenChange={setIsRepaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repayment schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Approved amount *</Label>
              <Input type="number" min="0" step="0.01" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} />
            </div>
            <div>
              <Label>Repayment</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={scheduleType} onChange={(e) => setScheduleType(e.target.value as RepaymentType)}>
                <option value="ONE_TIME">One-time deduction</option>
                <option value="INSTALMENTS">Monthly instalments</option>
              </select>
            </div>
            <div>
              <Label>Deduction starting month *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)}>
                <option value="">Select month</option>
                {employeePeriods.map((period) => (
                  <option key={period} value={period}>{period}</option>
                ))}
              </select>
            </div>
            {scheduleType === "INSTALMENTS" && (
              <div>
                <Label>Number of instalments</Label>
                <Input type="number" min="1" value={scheduleCount} onChange={(e) => setScheduleCount(e.target.value)} />
              </div>
            )}
            <div className="rounded-md border p-3 text-sm">
              {schedulePreview.length === 0 ? (
                <p className="text-muted-foreground">Choose a month to preview the schedule. A period that already has payroll stays as it is.</p>
              ) : schedulePreview.map((row) => (
                <div key={row.period} className="flex justify-between py-1">
                  <span>{row.period}</span>
                  <span>₹{row.amount}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRepaymentOpen(false)}>Cancel</Button>
            <Button onClick={saveRepayment}>{repaymentAdvance && ["Disbursed", "Partially Recovered", "Fully Recovered"].includes(repaymentAdvance.status) ? "Update schedule" : "Save and approve"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!disburseTarget} onOpenChange={(open) => { if (!open) setDisburseTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record disbursement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Disbursed amount *</Label>
              <Input type="number" min="0" step="0.01" value={disbursedAmount} onChange={(e) => setDisbursedAmount(e.target.value)} />
            </div>
            <div>
              <Label>Disbursement date *</Label>
              <Input type="date" value={disbursementDate} onChange={(e) => setDisbursementDate(e.target.value)} />
            </div>
            <div>
              <Label>Payment reference</Label>
              <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisburseTarget(null)}>Cancel</Button>
            <Button onClick={saveDisbursement}>Save disbursement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyAdvance} onOpenChange={(open) => { if (!open) setHistoryAdvance(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recovery history</DialogTitle>
          </DialogHeader>
          {historyAdvance && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>Requested</div><div>₹{historyAdvance.advanceAmount || "0"}</div>
                <div>Approved</div><div>₹{historyAdvance.approvedAmount || "—"}</div>
                <div>Disbursed</div><div>₹{historyAdvance.disbursedAmount || "—"}</div>
                <div>Recovered</div><div>₹{historyAdvance.recoveredAmount || "0"}</div>
                <div>Outstanding</div><div>₹{historyAdvance.outstandingBalance || "—"}</div>
              </div>
              <div className="rounded-md border">
                {(historyAdvance.repayments || []).length === 0 ? (
                  <p className="p-3 text-muted-foreground">No instalments yet.</p>
                ) : (historyAdvance.repayments || []).map((row) => (
                  <div key={`${row.id}-${row.periodLabel}`} className="flex justify-between border-b px-3 py-2 last:border-b-0">
                    <span>{row.periodLabel || "Unscheduled"}</span>
                    <span>₹{row.amount} · {row.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}