import { Type } from "class-transformer";
import {
  IsOptional,
  IsInt,
  IsString,
  IsEmail,
  IsArray,
  ValidateNested,
  Length,
  IsBoolean,
  IsNumber,
  ValidateBy,
  ValidationOptions,
} from "class-validator";

/** One 10-digit mobile, or a stored list (JSON array or pipe-separated) of them. */
export function isExactMobileNumber(value: unknown): boolean {
  if (value == null) return true;
  const raw = String(value).trim();
  if (!raw) return true;
  let parts: string[];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return false;
      parts = parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
    } catch {
      return false;
    }
  } else if (raw.includes("|")) {
    parts = raw.split("|").map((item) => item.trim()).filter(Boolean);
  } else {
    parts = [raw];
  }
  return parts.length > 0 && parts.every((part) => /^\d{10}$/.test(part));
}

export function IsExactMobileNumber(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: "isExactMobileNumber",
      validator: {
        validate: (value: unknown) => isExactMobileNumber(value),
        defaultMessage: () => "Mobile number must be exactly 10 digits",
      },
    },
    options,
  );
}

// ---------- Promotion DTO ----------
export class PromotionCreateDto {
  @IsOptional() @IsInt() departmentNameID?: number;
  @IsOptional() @IsInt() designationID?: number;
  @IsOptional() @IsInt() managerID?: number;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() typeOfEmployee?: string;
  @IsOptional() @IsString() employmentStatus?: string;
  @IsOptional() @IsString() probationPeriod?: string;
  @IsOptional() @IsInt() workShiftID?: number;
  @IsOptional() @IsInt() attendancePolicyID?: number;
  @IsOptional() @IsInt() leavePolicyID?: number;
  @IsOptional() @IsString() salaryPayGradeType?: string;
  @IsOptional() @IsInt() monthlyPayGradeID?: number;
  @IsOptional() @IsInt() hourlyPayGradeID?: number;
}

// ---------- Bank Details DTO ----------
export class BankDetailsCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankBranchName?: string;
  @IsOptional() @IsString() accountHolderName?: string;
  @IsOptional() @IsString() accNumber?: string;
  @IsOptional() @IsString() ifscCode?: string;
  @IsOptional() @IsString() upi?: string;
}

// ---------- Education DTO ----------
export class EduCreateDto {
  @IsOptional() @IsString() instituteType?: string;
  @IsOptional() @IsString() instituteName?: string;
  @IsOptional() @IsString() degree?: string;
  @IsOptional() @IsString() pasingYear?: string;
  @IsOptional() @IsString() marks?: string;
  @IsOptional() @IsString() gpaCgpa?: string;
  @IsOptional() @IsString() class?: string;
}

// ---------- Experience DTO ----------
export class ExpCreateDto {
  @IsOptional() @IsString() orgName?: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() fromDate?: string;
  @IsOptional() @IsString() toDate?: string;
  @IsOptional() @IsString() responsibility?: string;
  @IsOptional() @IsString() skill?: string;
}

// ---------- Employee Designation DTO ----------
export class EmpDesignationCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() designationID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Branch DTO ----------
export class EmpBranchCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() branchesID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Department DTO ----------
export class EmpDepartmentCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() departmentNameID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Employment Type DTO ----------
export class EmpEmploymentTypeCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Employment Status DTO ----------
export class EmpEmploymentStatusCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsString() employmentStatus?: string;
  @IsOptional() @IsString() probationPeriod?: string;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Work Shift DTO ----------
export class EmpWorkShiftCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() workShiftID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Attendance Policy DTO ----------
export class EmpAttendancePolicyCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() attendancePolicyID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Leave Policy DTO ----------
export class EmpLeavePolicyCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() leavePolicyID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Employee Contractor DTO ----------
export class EmpContractorCreateDto {
  @IsOptional() @IsInt() id?: number;
  @IsOptional() @IsInt() contractorID?: number;
  @IsOptional() @IsString() effectFrom?: string;
}

// ---------- Device Mapping DTO ----------
export class DevMapCreateDto {
   @IsOptional() @IsInt() id?: number;
  @IsInt() deviceID!: number;
  @IsOptional() @IsString() deviceEmpCode?: string;
  @IsOptional() @IsString() authType?: string;
}

export class TokenDeviceMapCreateDto  {
   @IsOptional() @IsInt() id?: number;
  @IsInt() deviceID!: number;
  @IsOptional() @IsString() deviceEmpCode?: string;
  @IsOptional() @IsString() authType?: string;
}

// ---------- Employee Credentials DTO ----------
export class EmployeeCredentialsCreateDto {
  @IsOptional()
  @IsEmail({}, { message: 'Username must be a valid email address' })
  username?: string;

  @IsOptional() @IsString()
@Length(6, 100, { message: 'Password must be at least 6 characters long' })
password?: string;

  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional() @IsBoolean() mustChangePassword?: boolean;

  @IsOptional() @IsString() passwordChangedAt?: string;
}

export class EmployeeCredentialsUpdateDto {
  @IsOptional()
  @IsEmail({}, { message: 'Username must be a valid email address' })
  username?: string;

  @IsOptional() @IsString()
  @Length(6, 100, { message: 'Password must be at least 6 characters long' })
  password?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsBoolean() mustChangePassword?: boolean;

  @IsOptional() @IsString() passwordChangedAt?: string;
}

// ---------- Login DTO ----------
export class EmployeeLoginDto {
  @IsString()
  @IsEmail({}, { message: 'Username must be a valid email address' })
  username!: string;

  @IsString()
  @Length(1, 100, { message: 'Password is required' })
  password!: string;
}


export class EmployeeDocumentDto {

  id?: number;

  documentName: string;

  documentCategory: string;

  description?: string;

  issuedDate?: Date;

  expiryDate?: Date;

  fileName?: string;

  fileUrl?: string;

  fileType?: string;

  fileSize?: number;
}

// ---------- Create Employee DTO ----------
export class CreateManageEmployeeDto {
  // FKs
  @IsOptional() @IsInt() serviceProviderID?: number;
  @IsOptional() @IsInt() companyID?: number;
  @IsOptional() @IsInt() branchesID?: number;
  @IsOptional() @IsInt() contractorID?: number;
  @IsOptional() @IsString() salaryPayoutTo?: string;

  // Scalars
  @IsOptional() @IsString() employeeFirstName?: string;
  @IsOptional() @IsString() employeeMiddleName?: string;
  @IsOptional() @IsString() employeeLastName?: string;

  @IsOptional()
  @IsString()
  employeeID?: string;

  @IsOptional() @IsString() empType?: string;

  @IsOptional() @IsString() pfMemberStatus?: string;

  @IsOptional() @IsString() pfNumber?: string;

  @IsOptional() @IsString() aadharNo?: string;
  @IsOptional() @IsString() panNo?: string;
  @IsOptional() @IsString() uanNo?: string;
  @IsOptional() @IsString() esiNo?: string;
  @IsOptional() @IsBoolean() esiApplies?: boolean;
  @IsOptional() @IsString() paymentMode?: string;
  @IsOptional() @IsString() salaryEffectiveDate?: string;
  @IsOptional() @IsInt() holidayCalendarID?: number;
  @IsOptional() privacyReview?: Record<string, unknown>;

  @IsOptional() @IsString() joiningDate?: string;

  @IsOptional() @IsString() businessPhoneNo?: string;
  @IsOptional() @IsEmail() businessEmail?: string;

  @IsOptional()
  @IsString()
  @IsExactMobileNumber()
  personalPhoneNo?: string;

  @IsOptional() @IsEmail() personalEmail?: string;
  @IsOptional() @IsString() emergancyContact?: string;
  @IsOptional() @IsArray() emergencyContacts?: { name?: string; relation?: string; contactNo?: string; priority?: string }[];

  @IsOptional() @IsString() presentAddress?: string;
  @IsOptional() @IsString() presentCity?: string;
  @IsOptional() @IsString() presentState?: string;
  @IsOptional() @IsString() presentPincode?: string;
  @IsOptional() @IsString() presentCountry?: string;
  @IsOptional() @IsBoolean() permanentSameAsCurrent?: boolean;
  @IsOptional() @IsString() permenantAddress?: string;

  @IsOptional() @IsString() employeePhotoUrl?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsInt() numberOfChildren?: number;
  @IsOptional() @IsString() dateOfBirth?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() maritalStatus?: string;
  @IsOptional() @IsString() employeeFatherName?: string;
  @IsOptional() @IsString() employeeMotherName?: string;
  @IsOptional() @IsString() employeeSpouseName?: string;

  @IsOptional() @IsInt() departmentNameID?: number;
  @IsOptional() @IsInt() designationID?: number;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() typeOfEmployee?: string;
  @IsOptional() @IsString() employmentStatus?: string;
  @IsOptional() @IsString() probationPeriod?: string;
  @IsOptional() @IsInt() workShiftID?: number;
  @IsOptional() @IsInt() attendancePolicyID?: number;
  @IsOptional() @IsInt() leavePolicyID?: number;
  @IsOptional() @IsString() salaryPayGradeType?: string;
  @IsOptional() @IsInt() monthlyPayGradeID?: number;
  @IsOptional() @IsInt() hourlyPayGradeID?: number;

  @IsOptional()
  @IsString()
  shiftEligibility?: string;

  @IsOptional()
  @IsString()
  nightShiftEligibility?: string;

  @IsOptional()
  @IsString()
  maxHoursPerDay?: string;

  @IsOptional()
  @IsString()
  weeklyOffPattern?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salaryCycleID?: number;

  @IsOptional()
  @IsString()
  noticePeriodDaysForResignation?: string;

  @IsOptional()
  @IsString()
  noticePeriodDaysForTermination?: string;

  @IsOptional() @IsBoolean()
  @Type(() => Boolean)
  allowRotatingShift?: boolean;

  @IsOptional() @IsBoolean()
  @Type(() => Boolean)
  allowCreateTaskOnMobile?: boolean;

  @IsOptional() @IsBoolean()
  @Type(() => Boolean)
  enableAttBranchOnly?: boolean;

  @IsOptional() @IsBoolean()
  @Type(() => Boolean)
  pwaShowLeaveBalance?: boolean;

  @IsOptional() @IsBoolean()
  @Type(() => Boolean)
  pwaShowLoanAdvances?: boolean;

  @IsOptional() @IsBoolean()
  @Type(() => Boolean)
  mobileAttendanceEnabled?: boolean;

  @IsOptional() @IsBoolean()
  @Type(() => Boolean)
  mobileBreakEnabled?: boolean;

  @IsOptional() @IsBoolean()
  @Type(() => Boolean)
  photoPunchEnabled?: boolean;

  @IsOptional() @IsBoolean()
  @Type(() => Boolean)
  wfhAllowed?: boolean;

  @IsOptional() @IsString()
  wfhHomeAddress?: string;

  @IsOptional() @IsNumber()
  wfhHomeLatitude?: number;

  @IsOptional() @IsNumber()
  wfhHomeLongitude?: number;

  @IsOptional() @IsString()
  placeId?: string;

  @IsOptional() @IsString()
  locationSource?: string;

  @IsOptional() @IsBoolean()
  @Type(() => Boolean)
  locationVerified?: boolean;

  @IsOptional() @IsBoolean()
  @Type(() => Boolean)
  refetchLocation?: boolean;

  // Nested arrays
  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EduCreateDto)
  edu?: EduCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankDetailsCreateDto)
  bankDetails?: BankDetailsCreateDto[];

  employeeDocuments?: EmployeeDocumentDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpCreateDto)
  exp?: ExpCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DevMapCreateDto)
  devices?: DevMapCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpDesignationCreateDto)
  empDesignations?: EmpDesignationCreateDto[];

   @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TokenDeviceMapCreateDto)
  tokenDevices?: TokenDeviceMapCreateDto[];  

  @IsOptional()
  @ValidateNested()
  @Type(() => PromotionCreateDto)
  promotion?: PromotionCreateDto;

  // Multi-value junction table arrays
  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpBranchCreateDto)
  empBranches?: EmpBranchCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpDepartmentCreateDto)
  empDepartments?: EmpDepartmentCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpEmploymentTypeCreateDto)
  empEmploymentTypes?: EmpEmploymentTypeCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpEmploymentStatusCreateDto)
  empEmploymentStatuses?: EmpEmploymentStatusCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpWorkShiftCreateDto)
  empWorkShifts?: EmpWorkShiftCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpAttendancePolicyCreateDto)
  empAttendancePolicies?: EmpAttendancePolicyCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpLeavePolicyCreateDto)
  empLeavePolicies?: EmpLeavePolicyCreateDto[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpContractorCreateDto)
  empContractors?: EmpContractorCreateDto[];
}

