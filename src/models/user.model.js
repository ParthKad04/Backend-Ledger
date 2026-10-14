const mongoose = require('mongoose');
const bcrypt = require('bcryptjs')


const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required for creating a user"],
        trim: true,
        lowercase: true,
        match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 
            "Invalid Email address"],
        unique: [true, "Email already exists"]
    },
    name: {
        type: String,
        required: [true,"Name is required for creating an account"]
    },
    password:{
        type: String,
        required: [true, "Password is required for creating an account"],
        minlength: [6, "password should contain more than 6  wercharacter"],
        select: false
    },
    systemUser:{
        type: Boolean,
        default: false,
        immutable: true,
        select: false
    }
},{
    timestamps: true
})

// In this function we check if the user password is changed so we have to make it hash value
// that is will change passwords plain txt to hash for privacy
userSchema.pre("save", async function(next){
    
    if (!this.isModified("password")){
        return next()
    }

    const hash = await bcrypt.hash(this.password, 10)
    this.password = hash

    return 

})

userSchema.methods.comparePassword = async function (password){

    console.log(password, this.password);
    

    return await bcrypt.compare(password, this.password)

}

const userModel = mongoose.model("user",userSchema)

module.exports = userModel
