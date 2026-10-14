const accountModel = require("../models/account.model");

/*
async function createAccountController(req, res) {

    const user = req.user;

    const account = await accountModel.create({
        user: user._id,
    })

    res.status(201).json({
        account
    })
}
    */


async function createAccountController(req, res) {

    const user = req.user;

    const account = await accountModel.create({
        user: user._id
    });

    res.status(201).json({
        account
    });
}


async function getUserAccountController(req, res) {

    const account = await accountModel.find({
        user: req.user._id
    });

    res.status(200).json({
        account
    });
}

async function getAccountBalanceController(req, res) {
    try {
        const accountId = req.params.accountId;

        const account = await accountModel.findOne({
            _id: accountId,
            user: req.user._id

        });
        console.log("Logged-in user ID:", String(req.user._id));
        console.log("Requested account ID:", String(accountId));

        if (!account) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        const balance = await account.getBalance();

        return res.status(200).json({
            accountId,
            balance
        });
    } catch (error) {
        console.error("Get account balance failed:", error);

        return res.status(500).json({
            message: "Failed to fetch account balance"
        });
    }
}


module.exports = {
    createAccountController,
    getUserAccountController,
    getAccountBalanceController
};


