const express = require('express');
const authMiddleware = require("../middleware/auth.middleware")
const accountController = require("../controllers/account.controller")

const router = express.Router()




/**
 * POST /api/account/
 * - Create a new account
 * - Protected route, requires authentication
 */
router.post("/", authMiddleware.authMiddleware, accountController.createAccountController)


/**
 * GET /api/account/
 * - Get all accounts of logged in user
 * - Protected route
 */
router.get("/", authMiddleware.authMiddleware, accountController.getUserAccountController)

/** 
 * - GET /api/account/balance/:accountId
 * */ 

//router.get("/balance/:accountId", authMiddleware.authMiddleware, accountController.getAccountBalanceController)
router.get(
    "/balance/:accountId",authMiddleware.authMiddleware,accountController.getAccountBalanceController);




module.exports = router