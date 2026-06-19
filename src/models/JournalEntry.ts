import mongoose from "mongoose";

const JournalEntrySchema = new mongoose.Schema(
  {
    entryNumber: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    description: { type: String, required: true },
    sourceType: {
      type: String,
      enum: ["payment", "cash_transaction", "manual"],
      required: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    status: {
      type: String,
      enum: ["draft", "posted", "cancelled"],
      default: "draft",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

type JournalStatus = "draft" | "posted" | "cancelled";

type JournalUpdate = {
  status?: JournalStatus;
  $set?: {
    status?: JournalStatus;
  };
};

function getRequestedStatus(update: unknown) {
  const journalUpdate = update as JournalUpdate | null;

  return journalUpdate?.$set?.status ?? journalUpdate?.status;
}

async function assertJournalEntryIsBalanced(
  journalEntryId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession | null
) {
  const JournalLine = mongoose.models.JournalLine;

  if (!JournalLine) {
    throw new Error("JournalLine model must be registered before posting a journal entry");
  }

  const aggregate = JournalLine.aggregate([
    { $match: { journalEntryId } },
    {
      $group: {
        _id: "$journalEntryId",
        debit: { $sum: "$debit" },
        credit: { $sum: "$credit" },
        lines: { $sum: 1 },
      },
    },
  ]);
  const totals = session ? await aggregate.session(session) : await aggregate;

  const total = totals[0];

  if (!total || total.lines < 2) {
    throw new Error("A posted journal entry must have at least two lines");
  }

  if (total.debit !== total.credit) {
    throw new Error("A posted journal entry must have equal debit and credit totals");
  }
}

async function blockPostedJournalEntryDelete(this: mongoose.Query<unknown, unknown>) {
  const journalEntry = await this.model
    .findOne(this.getFilter())
    .session((this.getOptions().session as mongoose.ClientSession | undefined) ?? null)
    .select("status")
    .lean();

  if (journalEntry?.status === "posted") {
    throw new Error("Posted journal entries cannot be deleted");
  }
}

JournalEntrySchema.pre("validate", async function () {
  if (this.status !== "posted") {
    return;
  }

  if (this.isNew) {
    throw new Error("A journal entry must be saved as draft before posting");
  }

  if (!this.isModified("status")) {
    return;
  }

  await assertJournalEntryIsBalanced(this._id);
});

JournalEntrySchema.pre("findOneAndUpdate", async function () {
  if (getRequestedStatus(this.getUpdate()) !== "posted") {
    return;
  }

  const session = (this.getOptions().session as mongoose.ClientSession | undefined) ?? null;
  const journalEntry = await this.model
    .findOne(this.getFilter())
    .session(session)
    .select("_id")
    .lean();
  if (!journalEntry?._id) {
    return;
  }

  await assertJournalEntryIsBalanced(
    journalEntry._id,
    session
  );
});

JournalEntrySchema.pre("deleteOne", { query: true, document: false }, blockPostedJournalEntryDelete);
JournalEntrySchema.pre("findOneAndDelete", blockPostedJournalEntryDelete);

export default mongoose.models.JournalEntry ||
  mongoose.model("JournalEntry", JournalEntrySchema);
