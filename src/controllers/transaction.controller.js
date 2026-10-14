const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const emailService = require("../servies/email.service");
const mongoose = require("mongoose");

async function createTransaction(req, res) {
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

    if (!fromAccount || !toAccount || !idempotencyKey || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({
            message: "fromAccount, toAccount, a positive amount, and idempotencyKey are required."
        });
    }

    if (!mongoose.isValidObjectId(fromAccount) || !mongoose.isValidObjectId(toAccount)) {
        return res.status(400).json({ message: "Invalid fromAccount or toAccount ID." });
    }

    if (String(fromAccount) === String(toAccount)) {
        return res.status(400).json({ message: "fromAccount and toAccount must be different." });
    }

    // Return the result of a previous request instead of processing it twice.
    const existing = await transactionModel.findOne({ idempotencyKey });
    if (existing) {
        if (existing.status === "COMPLETED") {
            return res.status(200).json({ message: "Transaction already processed.", transaction: existing });
        }
        return res.status(409).json({ message: `A transaction with this idempotency key already exists (${existing.status}).` });
    }

    console.log("Authenticated user:", String(req.user._id));
console.log("Requested sender account:", String(fromAccount));

const debugAccount = await accountModel.findById(fromAccount);
console.log(
    "Sender account owner:",
    debugAccount ? String(debugAccount.user) : "ACCOUNT NOT FOUND"
);

    // A normal user may only transfer from an account they own.
    const [fromUserAccount, toUserAccount] = await Promise.all([
        accountModel.findOne({ _id: fromAccount, user: req.user._id }),
        accountModel.findById(toAccount)
    ]);

    if (!fromUserAccount || !toUserAccount) {
        return res.status(400).json({ message: "Invalid fromAccount or toAccount, or fromAccount does not belong to the logged-in user." });
    }

    if (fromUserAccount.status !== "ACTIVE" || toUserAccount.status !== "ACTIVE") {
        return res.status(400).json({ message: "Both accounts must be ACTIVE to process a transaction." });
    }

    const transferAmount = Number(amount);
    const session = await mongoose.startSession();
    let transaction;

    try {
        await session.withTransaction(async () => {
            // Re-check idempotency inside the transaction to reduce duplicate processing.
            const duplicate = await transactionModel.findOne({ idempotencyKey }).session(session);
            if (duplicate) {
                const err = new Error("IDEMPOTENCY_CONFLICT");
                err.code = "IDEMPOTENCY_CONFLICT";
                throw err;
            }

            const balance = await fromUserAccount.getBalance();
            if (balance < transferAmount) {
                const err = new Error(`Insufficient balance. Current balance is ${balance}.`);
                err.code = "INSUFFICIENT_BALANCE";
                throw err;
            }

            [transaction] = await transactionModel.create([{
                fromAccount: fromUserAccount._id,
                toAccount: toUserAccount._id,
                amount: transferAmount,
                idempotencyKey,
                status: "PENDING"
            }], { session });

            await ledgerModel.create([
                { account: fromUserAccount._id, amount: transferAmount, transaction: transaction._id, type: "DEBIT" },
                { account: toUserAccount._id, amount: transferAmount, transaction: transaction._id, type: "CREDIT" }
            ], { session, ordered: true });

            transaction.status = "COMPLETED";
            await transaction.save({ session });
        });
    } catch (error) {
        if (error.code === "INSUFFICIENT_BALANCE") {
            return res.status(400).json({ message: error.message });
        }
        if (error.code === "IDEMPOTENCY_CONFLICT" || error.code === 11000) {
            const previous = await transactionModel.findOne({ idempotencyKey });
            if (previous?.status === "COMPLETED") {
                return res.status(200).json({ message: "Transaction already processed.", transaction: previous });
            }
            return res.status(409).json({ message: "This idempotency key has already been used." });
        }
        console.error("Transaction failed:", error);
        return res.status(500).json({ message: "Transaction failed. No partial ledger entries were committed." });
    } finally {
        await session.endSession();
    }

    // Email is best-effort: an email failure must not turn a committed transfer into an API failure.
    try {
        await emailService.sendTransactionEmail(req.user.email, req.user.name, transferAmount, toUserAccount._id);
    } catch (error) {
        console.error("Transaction email failed:", error.message);
    }

    return res.status(201).json({ message: "Transaction completed successfully.", transaction });
}

async function createInitialFundsTransaction(req, res) {
    const { toAccount, amount, idempotencyKey } = req.body;

    if (!toAccount || !idempotencyKey || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ message: "toAccount, a positive amount, and idempotencyKey are required." });
    }
    if (!mongoose.isValidObjectId(toAccount)) {
        return res.status(400).json({ message: "Invalid toAccount ID." });
    }

    const existing = await transactionModel.findOne({ idempotencyKey });
    if (existing) {
        if (existing.status === "COMPLETED") {
            return res.status(200).json({ message: "Transaction already processed.", transaction: existing });
        }
        return res.status(409).json({ message: "This idempotency key has already been used." });
    }

    const toUserAccount = await accountModel.findById(toAccount);
    if (!toUserAccount) return res.status(400).json({ message: "Invalid toAccount." });
    if (toUserAccount.status !== "ACTIVE") return res.status(400).json({ message: "toAccount must be ACTIVE." });

    // This endpoint is restricted by authSystemUserMiddleware. Use the authenticated system user's account.
    const fromUserAccount = await accountModel.findOne({ user: req.user._id });
    if (!fromUserAccount) return res.status(400).json({ message: "System user account not found. Create an account for the system user first." });

    const session = await mongoose.startSession();
    let transaction;
    try {
        await session.withTransaction(async () => {
            const duplicate = await transactionModel.findOne({ idempotencyKey }).session(session);
            if (duplicate) {
                const err = new Error("IDEMPOTENCY_CONFLICT");
                err.code = "IDEMPOTENCY_CONFLICT";
                throw err;
            }
            [transaction] = await transactionModel.create([{
                fromAccount: fromUserAccount._id,
                toAccount: toUserAccount._id,
                amount: Number(amount),
                idempotencyKey,
                status: "PENDING"
            }], { session });
            await ledgerModel.create([
                { account: fromUserAccount._id, amount: Number(amount), transaction: transaction._id, type: "DEBIT" },
                { account: toUserAccount._id, amount: Number(amount), transaction: transaction._id, type: "CREDIT" }
            ], { session, ordered: true });
            transaction.status = "COMPLETED";
            await transaction.save({ session });
        });
    } catch (error) {
        if (error.code === "IDEMPOTENCY_CONFLICT" || error.code === 11000) {
            const previous = await transactionModel.findOne({ idempotencyKey });
            if (previous?.status === "COMPLETED") return res.status(200).json({ message: "Transaction already processed.", transaction: previous });
            return res.status(409).json({ message: "This idempotency key has already been used." });
        }
        console.error("Initial funds transaction failed:", error);
        return res.status(500).json({ message: "Initial funds transaction failed. No partial ledger entries were committed." });
    } finally {
        await session.endSession();
    }

    return res.status(201).json({ message: "Initial funds transaction completed successfully.", transaction });
}

module.exports = { createTransaction, createInitialFundsTransaction };
