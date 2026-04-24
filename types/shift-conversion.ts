export type ShiftRecord = {
  employeeName: string
  shiftDate: string
  shiftCode: string
}

export type ShiftCodeMasterRow = {
  code: string
  defaultStartTime: string | null
  defaultEndTime: string | null
  defaultIsHoliday: boolean
  defaultLunchBreakStart: string | null
  defaultLunchBreakEnd: string | null
}

export type UnknownCount = {
  value: string
  count: number
}

export type ValidationResult = {
  canProceed: boolean
  recordCount: number
  unknownCodes: UnknownCount[]
  unknownNames: UnknownCount[]
  duplicateKeys: Array<{ employeeName: string; shiftDate: string; count: number }>
  warnings: string[]
}

export type ParseResult = {
  records: ShiftRecord[]
  warnings: string[]
}

export type ShiftConversionSuccessResponse = {
  validation: ValidationResult
  csvContent: string
  filename: string
}

/** 5 MB shared limit between client pre-check and server enforcement. */
export const SHIFT_CONVERSION_MAX_BYTES = 5 * 1024 * 1024
export const SHIFT_CONVERSION_MAX_MB = SHIFT_CONVERSION_MAX_BYTES / 1024 / 1024
