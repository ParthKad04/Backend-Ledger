require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");
const userModel = require("../models/user.model");

async function createSystemUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected");

        const existingUser = await userModel
            .findOne({ email: "system@ledger.com" })
            .select("+systemUser");

        if (existingUser) {
            console.log("System user already exists.");
            console.log("systemUser:", existingUser.systemUser);

            await mongoose.connection.close();
            return;
        }

        const systemUser = await userModel.create({
            email: "system@ledger.com",
            name: "System User",
            password: "System@123456",
            systemUser: true
        });

        console.log("System user created successfully!");
        console.log("ID:", systemUser._id);
        console.log("Email:", systemUser.email);
        console.log("systemUser:", systemUser.systemUser);

        await mongoose.connection.close();

    } catch (error) {
        console.error("Error creating system user:", error);

        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    }
}

createSystemUser();