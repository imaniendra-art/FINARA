import mongoose from "mongoose";

const JournalLineSchema = new mongoose.Schema(
  {
    journalEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
      required: true,
    },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    description: { type: String },
  },
  { timestamps: true }
);

// Ensure either debit or credit is > 0, but not both.
JournalLineSchema.pre("validate", function () {
  if (this.debit > 0 && this.credit > 0) {
    throw new Error("A journal line cannot have both debit and credit greater than 0");
  }
  if (this.debit === 0 && this.credit === 0) {
    throw new Error("A journal line must have either debit or credit greater than 0");
  }
});

type JournalEntrySnapshot = {
  status?: string;
};

type JournalLineSnapshot = {
  journalEntryId?: mongoose.Types.ObjectId;
};

type JournalLineUpdate = {
  journalEntryId?: mongoose.Types.ObjectId | string;
  $set?: {
    journalEntryId?: mongoose.Types.ObjectId | string;
  };
};

type JournalLineInsertManyDoc = {
  journalEntryId?: mongoose.Types.ObjectId | string;
};

function getUpdateJournalEntryId(update: unknown) {
  const journalLineUpdate = update as JournalLineUpdate | null;

  return journalLineUpdate?.$set?.journalEntryId ?? journalLineUpdate?.journalEntryId;
}

async function assertJournalEntryIsEditable(
  journalEntryId: mongoose.Types.ObjectId | string,
  session?: mongoose.ClientSession | null
) {
  const JournalEntry = mongoose.models.JournalEntry;

  if (!JournalEntry) {
    return;
  }

  const journalEntry = await JournalEntry.findById(journalEntryId)
    .session(session ?? null)
    .select("status")
    .lean<JournalEntrySnapshot | null>();

  if (journalEntry?.status === "posted") {
    throw new Error("Journal lines for posted journal entries cannot be changed");
  }
}

async function blockPostedJournalLineMutation(this: mongoose.Query<unknown, unknown>) {
  const session = (this.getOptions().session as mongoose.ClientSession | undefined) ?? null;
  const journalLine = await this.model
    .findOne(this.getFilter())
    .session(session)
    .select("journalEntryId")
    .lean<JournalLineSnapshot | null>();

  if (!journalLine?.journalEntryId) {
    return;
  }

  await assertJournalEntryIsEditable(journalLine.journalEntryId, session);

  const nextJournalEntryId = getUpdateJournalEntryId(this.getUpdate());
  if (nextJournalEntryId) {
    await assertJournalEntryIsEditable(nextJournalEntryId, session);
  }
}

async function blockPostedJournalLineDeleteMany(this: mongoose.Query<unknown, unknown>) {
  const session = (this.getOptions().session as mongoose.ClientSession | undefined) ?? null;
  const journalLines = await this.model
    .find(this.getFilter())
    .session(session)
    .select("journalEntryId")
    .lean<JournalLineSnapshot[]>();

  const journalEntryIds = [
    ...new Set(
      journalLines
        .map((line) => line.journalEntryId?.toString())
        .filter((journalEntryId): journalEntryId is string => Boolean(journalEntryId))
    ),
  ];

  await Promise.all(journalEntryIds.map((journalEntryId) => assertJournalEntryIsEditable(journalEntryId, session)));
}

JournalLineSchema.pre("save", async function () {
  await assertJournalEntryIsEditable(this.journalEntryId, this.$session());
});

JournalLineSchema.pre("insertMany", async function (...args: unknown[]) {
  const docs = args[0] as JournalLineInsertManyDoc[] | JournalLineInsertManyDoc;
  const lines = Array.isArray(docs) ? docs : [docs];
  const journalEntryIds = [
    ...new Set(
      lines
        .map((doc) => doc.journalEntryId)
        .filter((journalEntryId): journalEntryId is mongoose.Types.ObjectId | string => Boolean(journalEntryId))
    ),
  ];

  await Promise.all(journalEntryIds.map((journalEntryId) => assertJournalEntryIsEditable(journalEntryId)));
});

JournalLineSchema.pre("deleteOne", { query: true, document: false }, blockPostedJournalLineMutation);
JournalLineSchema.pre("deleteMany", { query: true, document: false }, blockPostedJournalLineDeleteMany);
JournalLineSchema.pre("findOneAndDelete", blockPostedJournalLineMutation);
JournalLineSchema.pre("findOneAndUpdate", blockPostedJournalLineMutation);
JournalLineSchema.pre("updateOne", { query: true, document: false }, blockPostedJournalLineMutation);

export default mongoose.models.JournalLine || mongoose.model("JournalLine", JournalLineSchema);
