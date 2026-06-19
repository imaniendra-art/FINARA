import mongoose from "mongoose";
import { z } from "zod";
import { userRoles } from "@/lib/roles";

export const objectIdSchema = z
  .string()
  .refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: "ID tidak valid",
  });

const optionalObjectIdSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || null)
  .refine((value) => value === null || mongoose.Types.ObjectId.isValid(value), {
    message: "ID tidak valid",
  });

export const studentBillInputSchema = z
  .object({
    studentId: objectIdSchema,
    feeTypeId: objectIdSchema,
    academicYear: z.string().trim().min(4, "Tahun akademik wajib diisi"),
    semester: z.string().trim().min(1, "Semester wajib diisi"),
    amount: z.coerce.number().nonnegative("Nominal tagihan tidak boleh negatif"),
    discount: z.coerce.number().nonnegative("Diskon tidak boleh negatif").default(0),
    dueDate: z.coerce.date(),
    notes: z.string().trim().optional(),
  })
  .refine((data) => data.discount <= data.amount, {
    message: "Diskon tidak boleh lebih besar dari nominal tagihan",
    path: ["discount"],
  });

const optionalFilterTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

export const bulkBillPreviewSchema = z.object({
  feeTypeId: objectIdSchema,
  academicYear: z.string().trim().min(4, "Tahun akademik wajib diisi"),
  semester: z.string().trim().min(1, "Semester wajib diisi"),
  entryYear: z.coerce.number().int("Angkatan harus berupa angka").optional(),
  programStudy: optionalFilterTextSchema,
  className: optionalFilterTextSchema,
  status: z.literal("active", { message: "Status mahasiswa harus aktif" }),
  biayaPendidikan: z.enum(["KIP", "Reguler"]).optional().or(z.literal("")).transform((val) => val || undefined),
});

export const bulkBillGenerateSchema = bulkBillPreviewSchema
  .extend({
    studentIds: z.array(objectIdSchema).min(1, "Pilih minimal satu mahasiswa"),
    amount: z.coerce.number().nonnegative("Nominal tagihan tidak boleh negatif"),
    discount: z.coerce.number().nonnegative("Diskon tidak boleh negatif").default(0),
    dueDate: z.coerce.date(),
    notes: z.string().trim().optional(),
  })
  .refine((data) => data.discount <= data.amount, {
    message: "Diskon tidak boleh lebih besar dari nominal tagihan",
    path: ["discount"],
  });

export const paymentInputSchema = z.object({
  billId: objectIdSchema,
  paymentDate: z.coerce.date(),
  amount: z.coerce.number().positive("Nominal pembayaran harus lebih besar dari nol"),
  paymentMethod: z.enum(["cash", "bank_transfer", "qris", "other"], {
    message: "Metode pembayaran tidak valid",
  }),
  cashOrBankAccountId: objectIdSchema,
  notes: z.string().trim().optional(),
});

export const cashTransactionInputSchema = z
  .object({
    date: z.coerce.date(),
    type: z.enum(["cash_in", "cash_out"], {
      message: "Tipe transaksi kas tidak valid",
    }),
    cashOrBankAccountId: objectIdSchema,
    accountId: objectIdSchema,
    amount: z.coerce.number().positive("Nominal wajib lebih dari 0"),
    description: z.string().trim().min(1, "Deskripsi wajib diisi"),
    notes: z.string().trim().optional(),
  })
  .refine((data) => data.cashOrBankAccountId !== data.accountId, {
    message: "Akun kas/bank dan akun lawan harus berbeda",
    path: ["accountId"],
  });

export const journalLineInputSchema = z
  .object({
    accountId: objectIdSchema,
    debit: z.coerce.number().nonnegative("Debit tidak boleh negatif").default(0),
    credit: z.coerce.number().nonnegative("Kredit tidak boleh negatif").default(0),
    description: z.string().trim().optional(),
  })
  .superRefine((line, context) => {
    if (line.debit > 0 && line.credit > 0) {
      context.addIssue({
        code: "custom",
        message: "Satu baris jurnal hanya boleh debit atau kredit",
        path: ["debit"],
      });
    }

    if (line.debit === 0 && line.credit === 0) {
      context.addIssue({
        code: "custom",
        message: "Satu baris jurnal harus memiliki debit atau kredit",
        path: ["debit"],
      });
    }
  });

export const manualJournalInputSchema = z
  .object({
    date: z.coerce.date(),
    description: z.string().trim().min(1, "Deskripsi jurnal wajib diisi"),
    lines: z.array(journalLineInputSchema).min(2, "Jurnal minimal memiliki 2 baris"),
  })
  .superRefine((journal, context) => {
    const totalDebit = journal.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = journal.lines.reduce((sum, line) => sum + line.credit, 0);

    if (totalDebit <= 0 || totalCredit <= 0) {
      context.addIssue({
        code: "custom",
        message: "Total debit dan kredit harus lebih dari 0",
        path: ["lines"],
      });
    }

    if (totalDebit !== totalCredit) {
      context.addIssue({
        code: "custom",
        message: "Total debit dan kredit harus balance",
        path: ["lines"],
      });
    }
  });

export const feeTypeInputSchema = z.object({
  name: z.string().trim().min(1, "Nama jenis tagihan wajib diisi"),
  description: z.string().trim().optional(),
  defaultAmount: z.coerce.number().nonnegative("Nominal default tidak boleh negatif"),
  revenueAccountId: objectIdSchema,
  isActive: z.coerce.boolean().default(true),
});

export const studentStatusSchema = z.enum(["active", "inactive", "graduated", "dropped_out"], {
  message: "Status mahasiswa tidak valid",
});

export const studentInputSchema = z.object({
  nim: z.string().trim().min(1, "NIM wajib diisi"),
  name: z.string().trim().min(1, "Nama wajib diisi"),
  gender: z
    .enum(["L", "P"], { message: "Jenis kelamin tidak valid" })
    .optional()
    .or(z.literal(""))
    .transform((val) => val || undefined),
  programStudy: z.string().trim().min(1, "Program studi wajib diisi"),
  className: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((val) => val || undefined),
  entryYear: z.coerce
    .number()
    .int("Tahun masuk harus berupa angka")
    .min(1900, "Tahun masuk tidak valid")
    .max(3000, "Tahun masuk tidak valid"),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  status: studentStatusSchema,
  biayaPendidikan: z.enum(["KIP", "Reguler"]).default("Reguler"),
});

const importTextSchema = z.preprocess(
  (value) => (value === null || value === undefined ? "" : String(value).trim()),
  z.string()
);
const requiredImportTextSchema = (message: string) =>
  z.preprocess(
    (value) => (value === null || value === undefined ? "" : String(value).trim()),
    z.string().min(1, message)
  );
const importEntryYearSchema = requiredImportTextSchema("Tahun masuk wajib diisi").transform((value, context) => {
  const entryYear = Number(value);

  if (!Number.isInteger(entryYear)) {
    context.addIssue({ code: "custom", message: "Tahun masuk harus berupa angka" });
    return z.NEVER;
  }

  if (entryYear < 1900 || entryYear > 3000) {
    context.addIssue({ code: "custom", message: "Tahun masuk tidak valid" });
    return z.NEVER;
  }

  return entryYear;
});

export const studentImportRowSchema = z.object({
  nim: requiredImportTextSchema("NIM wajib diisi"),
  name: requiredImportTextSchema("Nama wajib diisi"),
  gender: z.preprocess(
    (val) => (val === "L" || val === "P" ? val : undefined),
    z.enum(["L", "P"]).optional()
  ),
  programStudy: importTextSchema.transform((val) => val || "Manajemen"),
  className: importTextSchema.transform((val) => val || undefined),
  entryYear: importEntryYearSchema,
  phone: importTextSchema.optional(),
  address: importTextSchema.optional(),
  status: importTextSchema.transform((val) => val || "active").pipe(studentStatusSchema),
  biayaPendidikan: z.preprocess(
    (val) => (val === "KIP" || val === "Reguler" ? val : "Reguler"),
    z.enum(["KIP", "Reguler"])
  ).default("Reguler"),
  spp: importTextSchema.transform((value, context) => {
    if (!value) {
      return undefined;
    }

    const amount = Number(value);

    if (!Number.isFinite(amount) || amount <= 0) {
      context.addIssue({ code: "custom", message: "SPP harus berupa angka positif" });
      return z.NEVER;
    }

    return amount;
  }),
});

export const studentImportConfirmSchema = z.object({
  duplicateStrategy: z.enum(["skip", "update"]).default("skip"),
  rows: z.array(studentImportRowSchema.extend({ rowNumber: z.coerce.number().int().min(2) })).min(1),
});

export const journalImportRowSchema = z.object({
  noJurnal: requiredImportTextSchema("No. Jurnal wajib diisi"),
  tanggal: requiredImportTextSchema("Tanggal wajib diisi"),
  keteranganJurnal: requiredImportTextSchema("Keterangan jurnal wajib diisi"),
  kodeAkun: requiredImportTextSchema("Kode akun wajib diisi"),
  debit: importTextSchema.transform((value, context) => {
    if (!value || value === "0") return 0;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      context.addIssue({ code: "custom", message: "Debit harus berupa angka non-negatif" });
      return z.NEVER;
    }
    return amount;
  }),
  kredit: importTextSchema.transform((value, context) => {
    if (!value || value === "0") return 0;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      context.addIssue({ code: "custom", message: "Kredit harus berupa angka non-negatif" });
      return z.NEVER;
    }
    return amount;
  }),
  deskripsiBaris: importTextSchema.optional(),
});

export const journalImportConfirmSchema = z.object({
  rows: z.array(journalImportRowSchema.extend({ rowNumber: z.coerce.number().int().min(2) })).min(1),
});

export const accountTypeSchema = z.enum(["asset", "liability", "equity", "revenue", "expense"], {
  message: "Tipe akun tidak valid",
});

export const accountInputSchema = z.object({
  code: z.string().trim().min(1, "Kode akun wajib diisi"),
  name: z.string().trim().min(1, "Nama akun wajib diisi"),
  type: accountTypeSchema,
  parentId: optionalObjectIdSchema,
  normalBalance: z.enum(["debit", "credit"], {
    message: "Saldo normal wajib dipilih",
  }),
  isActive: z.coerce.boolean().default(true),
});

export const userRoleSchema = z.enum(userRoles, {
  message: "Role user tidak valid",
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi"),
  email: z.email("Email tidak valid").trim().toLowerCase(),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: userRoleSchema,
  isActive: z.coerce.boolean().default(true),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi"),
  email: z.email("Email tidak valid").trim().toLowerCase(),
  role: userRoleSchema,
  isActive: z.coerce.boolean().default(true),
});

export const userResetPasswordSchema = z.object({
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export const appSettingInputSchema = z.object({
  campusName: z.string().trim().min(1, "Nama kampus wajib diisi"),
  appName: z.string().trim().min(1, "Nama aplikasi wajib diisi"),
  appFullName: z.string().trim().min(1, "Nama lengkap aplikasi wajib diisi"),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  website: z.string().trim().optional(),
  leaderName: z.string().trim().optional(),
  leaderPosition: z.string().trim().optional(),
  logoUrl: z.string().trim().optional(),
  currency: z.string().trim().min(1).default("IDR"),
  timezone: z.string().trim().min(1).default("Asia/Makassar"),
  dateFormat: z.string().trim().min(1).default("dd/MM/yyyy"),
  defaultTheme: z.enum(["light", "dark", "system"]).default("light"),
  receiptPrefix: z.string().trim().min(1, "Prefix kwitansi wajib diisi"),
  receiptFooterText: z.string().trim().optional(),
  receiptSignerName: z.string().trim().optional(),
  receiptSignerPosition: z.string().trim().optional(),
  showCampusLogo: z.coerce.boolean().default(true),
});

export const academicPeriodInputSchema = z.object({
  academicYear: z.string().trim().min(1, "Tahun akademik wajib diisi"),
  semester: z.enum(["ganjil", "genap"], { message: "Semester harus ganjil atau genap" }),
  isActive: z.coerce.boolean().default(false),
});

export const budgetWorkUnitInputSchema = z.object({
  name: z.string().trim().min(1, "Nama unit wajib diisi"),
  code: z.string().trim().min(1, "Kode unit wajib diisi").toUpperCase(),
  description: z.string().trim().optional(),
  isActive: z.coerce.boolean().default(true),
});

export const budgetPeriodInputSchema = z
  .object({
    name: z.string().trim().min(1, "Nama periode wajib diisi"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isActive: z.coerce.boolean().default(false),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
    path: ["endDate"],
  });

export const budgetRequestStatusSchema = z.enum([
  "draft",
  "submitted",
  "verified",
  "approved",
  "rejected",
  "disbursed",
  "lpj_submitted",
  "completed",
  "cancelled",
]);

export const budgetRequestTypeSchema = z.enum(["proker", "incidental", "operational", "other"], {
  message: "Jenis permintaan tidak valid",
});

export const budgetRequestItemInputSchema = z.object({
  itemName: z.string().trim().min(1, "Nama item wajib diisi"),
  quantity: z.coerce.number().positive("Jumlah harus lebih dari 0"),
  unit: z.string().trim().min(1, "Satuan wajib diisi"),
  unitPrice: z.coerce.number().nonnegative("Harga satuan tidak boleh negatif"),
  note: z.string().trim().optional(),
  referenceUrl: z.string().trim().optional(),
});

export const budgetRequestInputSchema = z.object({
  requestDate: z.coerce.date(),
  requesterName: z.string().trim().min(1, "Nama pemohon wajib diisi"),
  unitId: objectIdSchema,
  periodId: optionalObjectIdSchema,
  requestType: budgetRequestTypeSchema,
  activityName: z.string().trim().min(1, "Nama kegiatan wajib diisi"),
  description: z.string().trim().optional(),
  items: z.array(budgetRequestItemInputSchema).min(1, "Minimal 1 item RAB"),
});

export const budgetVerifySchema = z.object({
  totalApprovedAmount: z.coerce.number().nonnegative("Nominal rekomendasi tidak boleh negatif").optional(),
  adminNote: z.string().trim().optional(),
  userNote: z.string().trim().optional(),
});

export const budgetApproveSchema = z.object({
  totalApprovedAmount: z.coerce.number().nonnegative("Nominal approval tidak boleh negatif").optional(),
  leaderNote: z.string().trim().optional(),
});

export const budgetRejectSchema = z.object({
  rejectionReason: z.string().trim().min(1, "Alasan penolakan wajib diisi"),
  adminNote: z.string().trim().optional(),
  leaderNote: z.string().trim().optional(),
  userNote: z.string().trim().optional(),
});

export const budgetDisburseSchema = z
  .object({
    disbursementNote: z.string().trim().optional(),
    disbursementProofUrl: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.disbursementNote || data.disbursementProofUrl), {
    message: "Catatan pencairan atau URL bukti wajib diisi",
    path: ["disbursementNote"],
  });

export const budgetSubmitLpjSchema = z
  .object({
    lpjNote: z.string().trim().optional(),
    lpjProofUrl: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.lpjNote || data.lpjProofUrl), {
    message: "Catatan LPJ atau URL bukti LPJ wajib diisi",
    path: ["lpjNote"],
  });

export const budgetCompleteSchema = z.object({
  adminNote: z.string().trim().optional(),
});

export const budgetCancelSchema = z.object({
  userNote: z.string().trim().optional(),
});

export type StudentBillInput = z.infer<typeof studentBillInputSchema>;
export type BulkBillPreviewInput = z.infer<typeof bulkBillPreviewSchema>;
export type BulkBillGenerateInput = z.infer<typeof bulkBillGenerateSchema>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;
export type CashTransactionInput = z.infer<typeof cashTransactionInputSchema>;
export type JournalLineInput = z.infer<typeof journalLineInputSchema>;
export type ManualJournalInput = z.infer<typeof manualJournalInputSchema>;
export type FeeTypeInput = z.infer<typeof feeTypeInputSchema>;
export type StudentInput = z.infer<typeof studentInputSchema>;
export type StudentImportRowInput = z.infer<typeof studentImportRowSchema>;
export type StudentImportConfirmInput = z.infer<typeof studentImportConfirmSchema>;
export type AccountInput = z.infer<typeof accountInputSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type UserResetPasswordInput = z.infer<typeof userResetPasswordSchema>;
export type AppSettingInput = z.infer<typeof appSettingInputSchema>;
export type AcademicPeriodInput = z.infer<typeof academicPeriodInputSchema>;
export type JournalImportRowInput = z.infer<typeof journalImportRowSchema>;
export type JournalImportConfirmInput = z.infer<typeof journalImportConfirmSchema>;
export type BudgetWorkUnitInput = z.infer<typeof budgetWorkUnitInputSchema>;
export type BudgetPeriodInput = z.infer<typeof budgetPeriodInputSchema>;
export type BudgetRequestInput = z.infer<typeof budgetRequestInputSchema>;
