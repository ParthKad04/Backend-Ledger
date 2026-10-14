const userModel = require("../models/user.model");
const jwt = require('jsonwebtoken');



/**
 * We have created a middleware function called authMiddleware
 *  that checks for the presence of a JWT token in the request cookies or headers. 
 * If the token is present, it verifies the token using the secret key and retrieves the associated user from the database.
 *  If the token is missing or invalid, an unauthorized access response is sent back to the client Error(401).
 */

async function authMiddleware(req, res, next) {
    
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1]

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized access. Token is missing."
        })
    }

    try {

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await userModel.findById(decoded.userId)

        req.user = user

        return next()

    }catch(err){

        return res.status(401).json({
            message: "Unauthorized access. Invalid token."
        })
    }

}

async function authSystemUserMiddleware(req, res, next) {

    const token = req.cookies.token || req.headers.authorization?.split(" ")[1]

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized access. Token is missing."
        })
    }

    try {

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await userModel.findById(decoded.userId).select("+systemUser")
        if(!user.systemUser){
            return res.status(403).json({
                message: "Forbidden access. User is not a system user."
            })
        }

        req.user = user

        return next()
    }
    catch(err){
        return res.status(401).json({
            message: "Unauthorized access. Invalid token."
        })
    }
}
module.exports = {
    authMiddleware, 
    authSystemUserMiddleware
}